import { knowledgeBaseArticles, searchKnowledgeBase } from '../data/knowledgeBase.js';
import { callGroqLLM } from './groqService.js';

/**
 * AI Wellness Agent Service — TRUE RAG Pipeline with Industry-Standard KB Metadata
 * 
 * Architecture:
 * 1. RETRIEVAL  — Hybrid RAG Search (Tags + Category + Evidence Grade Weighting)
 * 2. AUGMENT    — Construct structured prompt with Evidence Tiers (Grade A/B), DOIs, MeSH Ontologies
 * 3. GENERATE   — Send prompt to Groq LLM (llama-3.3-70b-versatile) for grounded generation
 * 4. PARSE      — Extract structured JSON (facts, interpretations, recommendations with clinical metadata)
 * 5. FALLBACK   — Seamless deterministic engine fallback
 */

export async function generateRetrospectiveAndPlan(userStr, baseDateStr, weeklySummary, activeGoal) {
  const targetSleep = activeGoal ? activeGoal.targetSleepHours : 8.0;
  const targetCals = activeGoal ? activeGoal.targetDailyCalories : 2000;
  const targetActivity = activeGoal ? activeGoal.targetActivityMinutes : 30;
  const targetWeight = activeGoal ? activeGoal.targetWeight : 75.0;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: RETRIEVAL — RAG Search matching low-performing tags
  // ═══════════════════════════════════════════════════════════════
  const tagsToQuery = [];
  if (weeklySummary.sleepAvg < targetSleep) tagsToQuery.push('sleep');
  if (weeklySummary.energyAvg < 6) tagsToQuery.push('energy');
  if (weeklySummary.caloriesAvg < (targetCals - 300) || weeklySummary.caloriesAvg > (targetCals + 500)) tagsToQuery.push('nutrition');
  if (weeklySummary.totalActivityMinutes < (targetActivity * 5)) tagsToQuery.push('activity');
  if (weeklySummary.weightDelta > 1.0 || weeklySummary.weightDelta < -2.0) tagsToQuery.push('weight');
  if (weeklySummary.moodAvg < 5) tagsToQuery.push('mood');

  if (tagsToQuery.length === 0) tagsToQuery.push('sleep');

  // Hybrid Search with RRF ranking
  const retrievedArticles = searchKnowledgeBase(tagsToQuery, null, 5);

  // Parse target activities list
  let targetActsList = [];
  if (activeGoal && activeGoal.targetActivities) {
    try {
      targetActsList = typeof activeGoal.targetActivities === 'string'
        ? JSON.parse(activeGoal.targetActivities)
        : activeGoal.targetActivities;
    } catch (e) {
      targetActsList = [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: AUGMENT — Build structured prompt with Clinical Evidence Tiers
  // ═══════════════════════════════════════════════════════════════
  const kbContext = retrievedArticles.map(art =>
    `[Article ID: ${art.id}] "${art.title}" (Category: ${art.category})\n  Grade: ${art.evidenceGrade}\n  DOI: ${art.doi}\n  MeSH Terms: ${art.meshTerms.join(', ')}\n  Evidence: ${art.evidence}\n  Guidelines: ${art.guidelines.join('; ')}`
  ).join('\n\n');

  const activitiesDescription = targetActsList.length > 0
    ? targetActsList.map(a => `${a.type}: ${a.durationMinutes} mins/day${a.quantity ? ` (${a.quantity} ${a.unit || ''})` : ''}`).join(', ')
    : `General workout: ${targetActivity} mins/day`;

  const systemPrompt = `You are an AI Wellness & Lifestyle Review Agent. Your role is to analyze a user's health tracking data and provide evidence-based wellness guidance.

CRITICAL RULES:
1. You are NOT a doctor. Never diagnose diseases, prescribe medications, or recommend clinical treatments.
2. Every recommendation MUST cite a specific Knowledge Base article ID (e.g., kb-sleep-hygiene) from the provided context.
3. Clearly separate FACTS (objective logged data) from INTERPRETATIONS (your analytical hypotheses).
4. Keep recommendations actionable, specific, and limited to lifestyle/wellness adjustments.
5. Generate recommendations tailored to each of the user's target activities.

Respond ONLY with valid JSON in this exact structure:
{
  "facts": ["<fact 1>", "<fact 2>", ...],
  "interpretations": ["<interpretation 1>", "<interpretation 2>", ...],
  "retrospectiveText": "<A 3-4 sentence weekly wellness retrospective narrative>",
  "proposedRecommendations": [
    {
      "category": "<Sleep|Nutrition|Activity (ActivityType)|Weight|Recovery>",
      "proposal": "<specific actionable recommendation>",
      "targetValue": <numeric target value>,
      "evidence": "<exact evidence text from the cited KB article>",
      "kbArticleId": "<article ID from knowledge base>",
      "evidenceGrade": "<Grade A (Meta-Analysis) | Grade B (Clinical Trial)>",
      "doi": "<DOI citation string>",
      "meshTerms": ["<term1>", "<term2>"]
    }
  ]
}`;

  const userPrompt = `## User's Weekly Health Data (Week ending ${baseDateStr})

- Average Sleep: ${weeklySummary.sleepAvg} hrs/night (Goal: ${targetSleep} hrs)
- Average Energy Score: ${weeklySummary.energyAvg}/10
- Average Mood Score: ${weeklySummary.moodAvg}/10
- Total Weekly Activity: ${weeklySummary.totalActivityMinutes} minutes (Goal: ${targetActivity * 7} mins/week)
- Average Daily Calories: ${weeklySummary.caloriesAvg} kcal (Goal: ${targetCals} kcal)
- Macros: Protein ${weeklySummary.proteinAvg}g, Carbs ${weeklySummary.carbsAvg}g, Fats ${weeklySummary.fatsAvg}g
- Weight Change: ${weeklySummary.weightDelta > 0 ? '+' : ''}${weeklySummary.weightDelta} kg
- Target Weight: ${targetWeight} kg
- Target Activities: ${activitiesDescription}

## Clinical Knowledge Base Evidence (Use ONLY these for citations)

${kbContext}

Based on the above data and retrieved clinical evidence, generate your review. Include recommendations for each target activity the user has configured. Populate evidenceGrade, doi, and meshTerms from the cited KB articles.`;

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: GENERATE — Call Groq LLM (llama-3.3-70b-versatile)
  // ═══════════════════════════════════════════════════════════════
  const llmResult = await callGroqLLM(systemPrompt, userPrompt, true);

  if (llmResult.success && llmResult.parsed) {
    const llmOutput = llmResult.parsed;

    const facts = Array.isArray(llmOutput.facts) && llmOutput.facts.length > 0
      ? llmOutput.facts
      : buildDeterministicFacts(weeklySummary, targetSleep, targetCals, targetActivity);

    const interpretations = Array.isArray(llmOutput.interpretations) && llmOutput.interpretations.length > 0
      ? llmOutput.interpretations
      : buildDeterministicInterpretations(weeklySummary, targetSleep);

    const retrospectiveText = typeof llmOutput.retrospectiveText === 'string' && llmOutput.retrospectiveText.length > 20
      ? llmOutput.retrospectiveText
      : buildDeterministicRetrospective(baseDateStr, weeklySummary, interpretations);

    let proposedRecommendations = [];
    if (Array.isArray(llmOutput.proposedRecommendations)) {
      proposedRecommendations = llmOutput.proposedRecommendations
        .filter(r => r.category && r.proposal && r.evidence && r.kbArticleId)
        .map(r => {
          const matchedKb = knowledgeBaseArticles.find(art => art.id === r.kbArticleId);
          return {
            category: String(r.category),
            proposal: String(r.proposal),
            targetValue: parseFloat(r.targetValue) || 0,
            evidence: String(r.evidence),
            kbArticleId: String(r.kbArticleId),
            evidenceGrade: r.evidenceGrade || (matchedKb ? matchedKb.evidenceGrade : 'Grade A (Clinical Guidelines)'),
            doi: r.doi || (matchedKb ? matchedKb.doi : ''),
            meshTerms: Array.isArray(r.meshTerms) ? r.meshTerms : (matchedKb ? matchedKb.meshTerms : [])
          };
        });
    }

    if (proposedRecommendations.length === 0) {
      proposedRecommendations = buildDeterministicRecommendations(weeklySummary, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList);
    }

    return {
      facts,
      interpretations,
      retrospectiveText,
      proposedRecommendations,
      retrievedArticles,
      llmPowered: true
    };
  }

  // Fallback engine
  const facts = buildDeterministicFacts(weeklySummary, targetSleep, targetCals, targetActivity);
  const interpretations = buildDeterministicInterpretations(weeklySummary, targetSleep);
  const retrospectiveText = buildDeterministicRetrospective(baseDateStr, weeklySummary, interpretations);
  const proposedRecommendations = buildDeterministicRecommendations(weeklySummary, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList);

  return {
    facts,
    interpretations,
    retrospectiveText,
    proposedRecommendations,
    retrievedArticles,
    llmPowered: false
  };
}

function buildDeterministicFacts(ws, targetSleep, targetCals, targetActivity) {
  return [
    `Logged sleep averaged ${ws.sleepAvg} hrs/night over the past 7 days (Goal: ${targetSleep} hrs).`,
    `Average energy score was reported at ${ws.energyAvg}/10 and mood score at ${ws.moodAvg}/10.`,
    `Total weekly physical activity reached ${ws.totalActivityMinutes} minutes (Goal: ${targetActivity * 7} mins/week).`,
    `Average daily calorie intake was ${ws.caloriesAvg} kcal (Protein: ${ws.proteinAvg}g, Carbs: ${ws.carbsAvg}g, Fats: ${ws.fatsAvg}g).`,
    `Weight net delta over the period was ${ws.weightDelta > 0 ? '+' : ''}${ws.weightDelta} kg.`
  ];
}

function buildDeterministicInterpretations(ws, targetSleep) {
  const interps = [];
  if (ws.sleepAvg < targetSleep) {
    interps.push(`The deficit of ${(targetSleep - ws.sleepAvg).toFixed(1)} hrs/night in average sleep is likely impacting daylight energy recovery scores.`);
  }
  if (ws.totalActivityMinutes >= 150 && ws.caloriesAvg < 1600) {
    interps.push('High physical activity output combined with low caloric intake may increase physiological stress and baseline muscle fatigue.');
  }
  if (ws.energyAvg >= 7 && ws.sleepAvg >= 7.5) {
    interps.push('Strong positive correlation observed between optimal sleep duration (≥7.5h) and elevated daytime energy ratings.');
  }
  if (interps.length === 0) {
    interps.push('Overall wellness metrics are aligned with your active targets. Focus on consistency and hydration.');
  }
  return interps;
}

function buildDeterministicRetrospective(baseDateStr, ws, interpretations) {
  return `Weekly Wellness Retrospective (${baseDateStr}): Over the past 7 days, your sleep averaged ${ws.sleepAvg} hours with an average energy rating of ${ws.energyAvg}/10. You completed ${ws.totalActivityMinutes} minutes of physical activity and consumed an average of ${ws.caloriesAvg} kcal daily. ${interpretations.join(' ')}`;
}

function buildDeterministicRecommendations(ws, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList) {
  const recs = [];

  if (ws.sleepAvg < targetSleep) {
    const sleepKb = retrievedArticles.find(a => a.category === 'Sleep') || knowledgeBaseArticles[0];
    recs.push({
      category: 'Sleep',
      proposal: `Increase target sleep to ${targetSleep} hrs/night and set a 10:30 PM wind-down reminder.`,
      targetValue: targetSleep,
      evidence: sleepKb.evidence,
      kbArticleId: sleepKb.id,
      evidenceGrade: sleepKb.evidenceGrade,
      doi: sleepKb.doi,
      meshTerms: sleepKb.meshTerms
    });
  }

  if (ws.caloriesAvg < (targetCals - 200)) {
    const nutKb = retrievedArticles.find(a => a.category === 'Nutrition') || knowledgeBaseArticles[1];
    recs.push({
      category: 'Nutrition',
      proposal: `Adjust daily target calories to ${targetCals} kcal to properly fuel active workouts and recovery.`,
      targetValue: targetCals,
      evidence: nutKb.evidence,
      kbArticleId: nutKb.id,
      evidenceGrade: nutKb.evidenceGrade,
      doi: nutKb.doi,
      meshTerms: nutKb.meshTerms
    });
  }

  const actKb = retrievedArticles.find(a => a.category === 'Activity') || knowledgeBaseArticles.find(a => a.id === 'kb-active-recovery') || knowledgeBaseArticles[2];

  if (Array.isArray(targetActsList) && targetActsList.length > 0) {
    targetActsList.forEach(act => {
      const actType = act.type || 'Workout';
      const duration = act.durationMinutes || 30;
      const qtyStr = act.quantity ? ` (${act.quantity} ${act.unit || 'mins'})` : '';
      recs.push({
        category: `Activity (${actType})`,
        proposal: `Maintain target of ${duration} mins/day for ${actType}${qtyStr} to support cardiovascular conditioning and Zone 2 active recovery.`,
        targetValue: duration,
        evidence: actKb.evidence,
        kbArticleId: actKb.id,
        evidenceGrade: actKb.evidenceGrade,
        doi: actKb.doi,
        meshTerms: actKb.meshTerms
      });
    });
  } else {
    recs.push({
      category: 'Activity',
      proposal: `Maintain a baseline target of ${targetActivity} minutes of physical activity per day.`,
      targetValue: targetActivity,
      evidence: actKb.evidence,
      kbArticleId: actKb.id,
      evidenceGrade: actKb.evidenceGrade,
      doi: actKb.doi,
      meshTerms: actKb.meshTerms
    });
  }

  return recs;
}
