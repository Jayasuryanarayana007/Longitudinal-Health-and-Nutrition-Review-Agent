import { knowledgeBaseArticles, searchKnowledgeBase } from '../data/knowledgeBase.js';
import { callGroqLLM } from './groqService.js';

/**
 * AI Wellness Agent Service — TRUE RAG Pipeline with Edge Case Handling
 * 
 * Architecture & Edge Cases:
 * 1. NO LOGS EDGE CASE   — If weeklySummary.logCount === 0, returns explicit "Insufficient Data" response without false deficit assumptions.
 * 2. NO GOALS EDGE CASE  — If activeGoal === null, returns explicit "Configure Goals" callouts rather than pretending goals exist.
 * 3. RETRIEVAL           — Hybrid RAG Search (Tags + Category + Evidence Grade Weighting)
 * 4. AUGMENT             — Construct structured prompt with Evidence Tiers (Grade A/B), DOIs, MeSH Ontologies
 * 5. GENERATE            — Send prompt to Groq LLM (llama-3.3-70b-versatile) for grounded generation
 * 6. PARSE & FALLBACK    — Extract structured JSON with seamless deterministic fallback
 */

export async function generateRetrospectiveAndPlan(userStr, baseDateStr, weeklySummary, activeGoal) {

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE 1: NO LOGS RECORDED (logCount === 0)
  // ═══════════════════════════════════════════════════════════════
  if (!weeklySummary || weeklySummary.logCount === 0) {
    const sleepKb = knowledgeBaseArticles.find(a => a.id === 'kb-sleep-consistency') || knowledgeBaseArticles[1];

    const facts = [
      `No daily health metrics logged for the 7-day period ending ${baseDateStr}.`,
      `Logged days count: 0 out of 7 days.`
    ];

    if (!activeGoal) {
      facts.push(`Active Wellness Goals Profile: Not configured yet.`);
    } else {
      facts.push(`Active Goals Profile (v${activeGoal.version}): Sleep ${activeGoal.targetSleepHours}h, Calories ${activeGoal.targetDailyCalories}kcal, Weight ${activeGoal.targetWeight}kg.`);
    }

    const interpretations = [
      `Insufficient Data: You haven't recorded any daily health metrics (meals, sleep duration, mood, energy, or activity) over the past 7 days.`,
      `To generate personalized AI retrospectives and gap analysis, start recording daily entries in the Data Logger.`
    ];

    const retrospectiveText = `Weekly Wellness Retrospective (${baseDateStr}): No health logs were recorded during this period. Regular daily logging is required to compute 7-day averages, analyze recovery trends, and evaluate active wellness goals.`;

    const proposedRecommendations = [
      {
        category: 'Data Logging',
        proposal: 'Start recording daily entries in the Data Logger (sleep, meals, activity, weight) for at least 3-7 days to enable personalized AI reviews.',
        targetValue: 7,
        evidence: 'Consistent longitudinal tracking over 7 consecutive days provides statistical baseline data required to identify circadian and metabolic recovery trends.',
        kbArticleId: sleepKb.id,
        evidenceGrade: sleepKb.evidenceGrade,
        doi: sleepKb.doi,
        meshTerms: ['Data Collection', 'Self-Report', 'Longitudinal Studies']
      }
    ];

    if (!activeGoal) {
      const nutKb = knowledgeBaseArticles.find(a => a.id === 'kb-energy-fueling') || knowledgeBaseArticles[2];
      proposedRecommendations.push({
        category: 'Goals Profile',
        proposal: 'Set your custom target goals profile in the Active Wellness Goals card (weight, calories, sleep, and target activities).',
        targetValue: 1,
        evidence: nutKb.evidence,
        kbArticleId: nutKb.id,
        evidenceGrade: nutKb.evidenceGrade,
        doi: nutKb.doi,
        meshTerms: ['Goals', 'Behavior Control', 'Health Planning']
      });
    }

    return {
      facts,
      interpretations,
      retrospectiveText,
      proposedRecommendations,
      retrievedArticles: [sleepKb],
      llmPowered: false
    };
  }

  // Target Goal Values (with clean handling for no goals case)
  const hasGoal = activeGoal !== null && activeGoal !== undefined;
  const targetSleep = hasGoal ? activeGoal.targetSleepHours : 8.0;
  const targetCals = hasGoal ? activeGoal.targetDailyCalories : 2000;
  const targetActivity = hasGoal ? activeGoal.targetActivityMinutes : 30;
  const targetWeight = hasGoal ? activeGoal.targetWeight : 75.0;

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

  const retrievedArticles = searchKnowledgeBase(tagsToQuery, null, 5);

  let targetActsList = [];
  if (hasGoal && activeGoal.targetActivities) {
    try {
      targetActsList = typeof activeGoal.targetActivities === 'string'
        ? JSON.parse(activeGoal.targetActivities)
        : activeGoal.targetActivities;
    } catch (e) {
      targetActsList = [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: AUGMENT — Build structured prompt
  // ═══════════════════════════════════════════════════════════════
  const kbContext = retrievedArticles.map(art =>
    `[Article ID: ${art.id}] "${art.title}" (Category: ${art.category})\n  Grade: ${art.evidenceGrade}\n  DOI: ${art.doi}\n  MeSH Terms: ${art.meshTerms.join(', ')}\n  Evidence: ${art.evidence}\n  Guidelines: ${art.guidelines.join('; ')}`
  ).join('\n\n');

  const activitiesDescription = targetActsList.length > 0
    ? targetActsList.map(a => `${a.type}: ${a.durationMinutes} mins/day${a.quantity ? ` (${a.quantity} ${a.unit || ''})` : ''}`).join(', ')
    : (hasGoal ? `General workout: ${targetActivity} mins/day` : 'No target activities configured yet');

  const systemPrompt = `You are an AI Wellness & Lifestyle Review Agent. Your role is to analyze a user's health tracking data and provide evidence-based wellness guidance.

CRITICAL RULES:
1. You are NOT a doctor. Never diagnose diseases, prescribe medications, or recommend clinical treatments.
2. Every recommendation MUST cite a specific Knowledge Base article ID (e.g., kb-sleep-hygiene) from the provided context.
3. Clearly separate FACTS (objective logged data) from INTERPRETATIONS (your analytical hypotheses).
4. If no custom active goals profile is set, explicitly note that targets are unconfigured.
5. Keep recommendations actionable, specific, and limited to lifestyle/wellness adjustments.

Respond ONLY with valid JSON in this exact structure:
{
  "facts": ["<fact 1>", "<fact 2>", ...],
  "interpretations": ["<interpretation 1>", "<interpretation 2>", ...],
  "retrospectiveText": "<A 3-4 sentence weekly wellness retrospective narrative>",
  "proposedRecommendations": [
    {
      "category": "<Sleep|Nutrition|Activity (ActivityType)|Weight|Recovery|Goals>",
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

- Logged Days: ${weeklySummary.logCount} out of 7 days
- Active Goals Profile: ${hasGoal ? `Version v${activeGoal.version}` : 'Not configured yet'}
- Average Sleep: ${weeklySummary.sleepAvg} hrs/night ${hasGoal ? `(Goal: ${targetSleep} hrs)` : '(No goal set)'}
- Average Energy Score: ${weeklySummary.energyAvg}/10
- Average Mood Score: ${weeklySummary.moodAvg}/10
- Total Weekly Activity: ${weeklySummary.totalActivityMinutes} minutes ${hasGoal ? `(Goal: ${targetActivity * 7} mins/week)` : ''}
- Average Daily Calories: ${weeklySummary.caloriesAvg} kcal ${hasGoal ? `(Goal: ${targetCals} kcal)` : ''}
- Macros: Protein ${weeklySummary.proteinAvg}g, Carbs ${weeklySummary.carbsAvg}g, Fats ${weeklySummary.fatsAvg}g
- Weight Change: ${weeklySummary.weightDelta > 0 ? '+' : ''}${weeklySummary.weightDelta} kg
- Target Weight: ${hasGoal ? `${targetWeight} kg` : 'Not set'}
- Target Activities: ${activitiesDescription}

## Clinical Knowledge Base Evidence (Use ONLY these for citations)

${kbContext}

Based on the above data and retrieved clinical evidence, generate your review. ${!hasGoal ? 'Note in facts and interpretations that no custom active goals profile has been set yet.' : ''}`;

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: GENERATE — Call Groq LLM (llama-3.3-70b-versatile)
  // ═══════════════════════════════════════════════════════════════
  const llmResult = await callGroqLLM(systemPrompt, userPrompt, true);

  if (llmResult.success && llmResult.parsed) {
    const llmOutput = llmResult.parsed;

    const facts = Array.isArray(llmOutput.facts) && llmOutput.facts.length > 0
      ? llmOutput.facts
      : buildDeterministicFacts(weeklySummary, targetSleep, targetCals, targetActivity, hasGoal);

    const interpretations = Array.isArray(llmOutput.interpretations) && llmOutput.interpretations.length > 0
      ? llmOutput.interpretations
      : buildDeterministicInterpretations(weeklySummary, targetSleep, hasGoal);

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
      proposedRecommendations = buildDeterministicRecommendations(weeklySummary, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList, hasGoal);
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
  const facts = buildDeterministicFacts(weeklySummary, targetSleep, targetCals, targetActivity, hasGoal);
  const interpretations = buildDeterministicInterpretations(weeklySummary, targetSleep, hasGoal);
  const retrospectiveText = buildDeterministicRetrospective(baseDateStr, weeklySummary, interpretations);
  const proposedRecommendations = buildDeterministicRecommendations(weeklySummary, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList, hasGoal);

  return {
    facts,
    interpretations,
    retrospectiveText,
    proposedRecommendations,
    retrievedArticles,
    llmPowered: false
  };
}

function buildDeterministicFacts(ws, targetSleep, targetCals, targetActivity, hasGoal) {
  const f = [
    `Logged sleep averaged ${ws.sleepAvg} hrs/night over ${ws.logCount} logged days ${hasGoal ? `(Goal: ${targetSleep} hrs)` : ''}.`,
    `Average energy score was reported at ${ws.energyAvg}/10 and mood score at ${ws.moodAvg}/10.`,
    `Total weekly physical activity reached ${ws.totalActivityMinutes} minutes ${hasGoal ? `(Goal: ${targetActivity * 7} mins/week)` : ''}.`,
    `Average daily calorie intake was ${ws.caloriesAvg} kcal (Protein: ${ws.proteinAvg}g, Carbs: ${ws.carbsAvg}g, Fats: ${ws.fatsAvg}g).`,
    `Weight net delta over the period was ${ws.weightDelta > 0 ? '+' : ''}${ws.weightDelta} kg.`
  ];
  if (!hasGoal) {
    f.push(`Active Wellness Goals Profile: Not configured yet.`);
  }
  return f;
}

function buildDeterministicInterpretations(ws, targetSleep, hasGoal) {
  const interps = [];
  if (!hasGoal) {
    interps.push('Initial Setup Notice: No active target goals profile has been set yet. Configuring custom target goals enables accurate gap analysis.');
  }
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

function buildDeterministicRecommendations(ws, targetSleep, targetCals, targetActivity, retrievedArticles, targetActsList, hasGoal) {
  const recs = [];

  if (!hasGoal) {
    const nutKb = knowledgeBaseArticles.find(a => a.id === 'kb-energy-fueling') || knowledgeBaseArticles[2];
    recs.push({
      category: 'Goals Profile',
      proposal: 'Configure your initial target goals profile in the Active Wellness Goals card to personalize future AI retrospectives.',
      targetValue: 1,
      evidence: nutKb.evidence,
      kbArticleId: nutKb.id,
      evidenceGrade: nutKb.evidenceGrade,
      doi: nutKb.doi,
      meshTerms: ['Goals', 'Behavior Control', 'Health Planning']
    });
  }

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
