import { knowledgeBaseArticles } from '../data/knowledgeBase.js';

/**
 * AI Wellness Agent Service
 * Performs RAG retrieval, Facts vs. Interpretations separation, and Plan Generation.
 * Supports server-side Gemini API (if process.env.GEMINI_API_KEY is present) with smart local RAG fallback.
 */
export async function generateRetrospectiveAndPlan(userStr, baseDateStr, weeklySummary, activeGoal) {
  const targetSleep = activeGoal ? activeGoal.targetSleepHours : 8.0;
  const targetCals = activeGoal ? activeGoal.targetDailyCalories : 2000;
  const targetActivity = activeGoal ? activeGoal.targetActivityMinutes : 30;
  const targetWeight = activeGoal ? activeGoal.targetWeight : 75.0;

  // 1. RAG Retrieval: Match low-performing tags against knowledge base
  const tagsToQuery = new Set();
  if (weeklySummary.sleepAvg < targetSleep) tagsToQuery.add('sleep');
  if (weeklySummary.energyAvg < 6) tagsToQuery.add('energy');
  if (weeklySummary.caloriesAvg < (targetCals - 300) || weeklySummary.caloriesAvg > (targetCals + 500)) tagsToQuery.add('nutrition');
  if (weeklySummary.totalActivityMinutes < (targetActivity * 5)) tagsToQuery.add('activity');
  if (weeklySummary.weightDelta > 1.0 || weeklySummary.weightDelta < -2.0) tagsToQuery.add('weight');

  // Default to general sleep/recovery if all metrics are good
  if (tagsToQuery.size === 0) tagsToQuery.add('sleep');

  const retrievedArticles = knowledgeBaseArticles.filter(art =>
    art.tags.some(tag => tagsToQuery.has(tag))
  );

  // 2. Fact Extraction (Raw logged metrics)
  const facts = [
    `Logged sleep averaged ${weeklySummary.sleepAvg} hrs/night over the past 7 days (Goal: ${targetSleep} hrs).`,
    `Average energy score was reported at ${weeklySummary.energyAvg}/10 and mood score at ${weeklySummary.moodAvg}/10.`,
    `Total weekly physical activity reached ${weeklySummary.totalActivityMinutes} minutes (Goal: ${targetActivity * 7} mins/week).`,
    `Average daily calorie intake was ${weeklySummary.caloriesAvg} kcal (Protein: ${weeklySummary.proteinAvg}g, Carbs: ${weeklySummary.carbsAvg}g, Fats: ${weeklySummary.fatsAvg}g).`,
    `Weight net delta over the period was ${weeklySummary.weightDelta > 0 ? '+' : ''}${weeklySummary.weightDelta} kg.`
  ];

  // 3. Contextual Interpretations (AI hypotheses based on RAG evidence)
  const interpretations = [];
  if (weeklySummary.sleepAvg < targetSleep) {
    interpretations.push(`The deficit of ${(targetSleep - weeklySummary.sleepAvg).toFixed(1)} hrs/night in average sleep is likely impacting daylight energy recovery scores.`);
  }
  if (weeklySummary.totalActivityMinutes >= (targetActivity * 5) && weeklySummary.caloriesAvg < 1600) {
    interpretations.push('High physical activity output combined with low caloric intake may increase physiological stress and baseline muscle fatigue.');
  }
  if (weeklySummary.energyAvg >= 7 && weeklySummary.sleepAvg >= 7.5) {
    interpretations.push('Strong positive correlation observed between optimal sleep duration (≥7.5h) and elevated daytime energy ratings.');
  }
  if (interpretations.length === 0) {
    interpretations.push('Overall wellness metrics are aligned with your active targets. Focus on consistency and hydration.');
  }

  // 4. Editable Retrospective Narrative
  const retrospectiveText = `Weekly Wellness Retrospective (${baseDateStr}): Over the past 7 days, your sleep averaged ${weeklySummary.sleepAvg} hours with an average energy rating of ${weeklySummary.energyAvg}/10. You completed ${weeklySummary.totalActivityMinutes} minutes of physical activity and consumed an average of ${weeklySummary.caloriesAvg} kcal daily. ${interpretations.join(' ')}`;

  // 5. Proposed Plan Adjustments (Citing RAG Evidence)
  const proposedRecommendations = [];

  if (weeklySummary.sleepAvg < targetSleep) {
    const sleepKb = retrievedArticles.find(a => a.category === 'Sleep') || knowledgeBaseArticles[0];
    proposedRecommendations.push({
      category: 'Sleep',
      proposal: `Increase target sleep to ${targetSleep} hrs/night and set a 10:30 PM wind-down reminder.`,
      targetValue: targetSleep,
      evidence: sleepKb.evidence,
      kbArticleId: sleepKb.id
    });
  }

  if (weeklySummary.caloriesAvg < (targetCals - 200)) {
    const nutKb = retrievedArticles.find(a => a.category === 'Nutrition') || knowledgeBaseArticles[1];
    proposedRecommendations.push({
      category: 'Nutrition',
      proposal: `Adjust daily target calories to ${targetCals} kcal to properly fuel active workouts and recovery.`,
      targetValue: targetCals,
      evidence: nutKb.evidence,
      kbArticleId: nutKb.id
    });
  }

  // Dynamic Multiple Activity Proposals based on user's Active Goals Profile
  const actKb = retrievedArticles.find(a => a.category === 'Activity') || knowledgeBaseArticles.find(a => a.id === 'kb-active-recovery') || knowledgeBaseArticles[2];
  
  let targetActsList = [];
  if (activeGoal && activeGoal.targetActivities) {
    try {
      targetActsList = typeof activeGoal.targetActivities === 'string'
        ? JSON.parse(activeGoal.targetActivities)
        : activeGoal.targetActivities;
    } catch(e) {
      targetActsList = [];
    }
  }

  if (Array.isArray(targetActsList) && targetActsList.length > 0) {
    targetActsList.forEach(act => {
      const actType = act.type || 'Workout';
      const duration = act.durationMinutes || 30;
      const qtyStr = act.quantity ? ` (${act.quantity} ${act.unit || 'mins'})` : '';

      proposedRecommendations.push({
        category: `Activity (${actType})`,
        proposal: `Maintain target of ${duration} mins/day for ${actType}${qtyStr} to support cardiovascular conditioning and Zone 2 active recovery.`,
        targetValue: duration,
        evidence: actKb.evidence,
        kbArticleId: actKb.id
      });
    });
  } else {
    proposedRecommendations.push({
      category: 'Activity',
      proposal: `Maintain a baseline target of ${targetActivity} minutes of physical activity per day.`,
      targetValue: targetActivity,
      evidence: actKb.evidence,
      kbArticleId: actKb.id
    });
  }

  // 6. Check optional Gemini API Key
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const promptText = `Analyze these user health metrics: Sleep=${weeklySummary.sleepAvg}h, Energy=${weeklySummary.energyAvg}/10, Calories=${weeklySummary.caloriesAvg}kcal, Activity=${weeklySummary.totalActivityMinutes}m. Provide a 2-sentence empathetic retrospective.`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const geminiRes = await globalThis.fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const geminiOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiOutput) {
          interpretations.push(`Gemini Insight: ${geminiOutput.trim()}`);
        }
      }
    } catch (e) {
      // Gracefully fall back to local RAG
    }
  }

  return {
    facts,
    interpretations,
    retrospectiveText,
    proposedRecommendations,
    retrievedArticles
  };
}
