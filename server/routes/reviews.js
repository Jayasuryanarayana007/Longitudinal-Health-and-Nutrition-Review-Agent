import { Router } from 'express';
import { getDbConnection } from '../data/db.js';
import { foodDictionary } from '../data/foodDictionary.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Curated Wellness Knowledge Base (Ground Truth Articles)
const knowledgeBase = [
  {
    "id": "kb-sleep-hygiene",
    "title": "Circadian Rhythm Alignment and Wind-down Protocols",
    "category": "Sleep",
    "tags": ["sleep", "recovery", "energy", "insomnia"],
    "evidence": "Consistent wake times and keeping wind-down routines free of screen blue-light supports melatonin synthesis.",
    "guidelines": [
      "Keep screen time to a minimum 60 minutes before bedtime.",
      "Reduce caffeine intake after 2:00 PM to protect sleep architecture.",
      "Target a minimum of 7 to 9 hours of sleep daily for recovery."
    ]
  },
  {
    "id": "kb-energy-balance",
    "title": "Optimal Fueling for Zone 2 Cardio and High Activity",
    "category": "Nutrition",
    "tags": ["nutrition", "activity", "fatigue", "deficit"],
    "evidence": "Adequate glycogen replenishment preserves lean muscle tissue and prevents chronic physical fatigue.",
    "guidelines": [
      "Target 2.0g of carbohydrate per kg body weight on active days.",
      "Maintain a consistent eating schedule within 3-4 hours post-workout.",
      "Fuel adequately before long workouts (at least 300-500 kcal)."
    ]
  },
  {
    "id": "kb-daily-movement",
    "title": "WHO Physical Activity and Sedentary Behavior Guidelines",
    "category": "Activity",
    "tags": ["activity", "exercise", "sedentary"],
    "evidence": "Engaging in regular physical activity decreases cardiovascular risk and elevates cognitive mood indicators.",
    "guidelines": [
      "Aim for 150-300 minutes of moderate-intensity aerobic physical activity per week.",
      "Incorporate strength training targeting major muscle groups at least 2 days a week.",
      "Break up long sedentary periods with 5-minute walking intervals."
    ]
  },
  {
    "id": "kb-stress-management",
    "title": "Cortisol Regulation and Circadian Rhythm Alignment",
    "category": "Mood",
    "tags": ["mood", "stress", "energy", "fatigue"],
    "evidence": "Mindfulness practices and proper sleep timings lower resting cortisol levels, stabilizing mood and daily focus.",
    "guidelines": [
      "Incorporate 10 minutes of deep-breathing or meditation on high-stress days.",
      "Align sleep-wake timings within a 1-hour window daily.",
      "Log energy fluctuations to identify daily focus windows."
    ]
  }
];

// Helper to run tag-based RAG search on KB
function performRagLookup(stats) {
  const matchedArticles = [];
  
  if (stats.avgSleep < 7.0) {
    matchedArticles.push(knowledgeBase.find(a => a.id === 'kb-sleep-hygiene'));
  }
  if (stats.avgEnergy < 6.0 || stats.avgMood < 6.0) {
    matchedArticles.push(knowledgeBase.find(a => a.id === 'kb-stress-management'));
  }
  if (stats.totalActivityMins < 150) {
    matchedArticles.push(knowledgeBase.find(a => a.id === 'kb-daily-movement'));
  }
  
  // Default fallback if no deficits
  if (matchedArticles.length === 0) {
    matchedArticles.push(knowledgeBase.find(a => a.id === 'kb-energy-balance'));
  }
  
  return matchedArticles;
}

// POST /meals/extract - Extract food items from text (Dual-Mode: Gemini vs. 200-food dictionary)
router.post('/meals/extract', async (req, res, next) => {
  const { textInput } = req.body;

  if (!textInput || textInput.trim() === '') {
    return res.status(400).json({ success: false, message: 'Meal text is required.' });
  }

  const hasApiKey = !!process.env.GEMINI_API_KEY;
  let isAiUncertain = false;
  let extractedItems = [];

  try {
    if (hasApiKey) {
      // MODE A: Live Gemini API
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
          You are an AI wellness calorie extractor.
          Extract the food items and estimate the calories, protein (g), carbs (g), and fats (g) from the following user meal description.
          Respond ONLY with a JSON array of food items, with no markdown code fences, no extra text.
          If you are highly uncertain about an item, add a flag "isAiUncertain": true inside that item.
          
          Format:
          [
            { "foodItem": "item name", "calories": 250, "protein": 10, "carbs": 30, "fats": 8, "isAiUncertain": false }
          ]

          User Input: "${textInput}"
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Sanitize response text in case markdown wrapper was returned
        let cleanText = responseText;
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        extractedItems = JSON.parse(cleanText.trim());
        isAiUncertain = extractedItems.some(item => item.isAiUncertain === true);

      } catch (geminiError) {
        console.error('Gemini API failed, falling back to local NoSQL parser:', geminiError);
        // Fall back to dictionary mode on error
        const localResult = parseMealsLocally(textInput);
        extractedItems = localResult.items;
        isAiUncertain = localResult.isUncertain;
      }
    } else {
      // MODE B: Local Heuristics Simulator (using 200 Indian/American food dictionary)
      const localResult = parseMealsLocally(textInput);
      extractedItems = localResult.items;
      isAiUncertain = localResult.isUncertain;
    }

    return res.json({
      success: true,
      aiMode: hasApiKey ? 'Gemini 1.5 Flash' : 'Local Heuristics Simulator',
      isAiUncertain,
      extractedItems
    });

  } catch (error) {
    next(error);
  }
});

// Helper for local keyword matching meal extraction
function parseMealsLocally(text) {
  const textLower = text.toLowerCase();
  const foundItems = [];
  let isUncertain = false;
  
  // Split input by commas or "and" to look for multiple foods
  const segments = textLower.split(/,|\band\b/);

  segments.forEach(segment => {
    const trimmed = segment.trim();
    if (trimmed === '') return;

    let matched = false;
    
    // Look through our 200 food dictionary for keys contained in the text segment
    for (const foodKey of Object.keys(foodDictionary)) {
      if (trimmed.includes(foodKey)) {
        foundItems.push({
          foodItem: foodKey.charAt(0).toUpperCase() + foodKey.slice(1),
          calories: foodDictionary[foodKey].calories,
          protein: foodDictionary[foodKey].protein,
          carbs: foodDictionary[foodKey].carbs,
          fats: foodDictionary[foodKey].fats,
          isAiUncertain: false
        });
        matched = true;
        break;
      }
    }

    // If no dictionary match is found, add a fallback generic item and flag uncertainty
    if (!matched) {
      foundItems.push({
        foodItem: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
        calories: 300, // Fallback default calories
        protein: 10,
        carbs: 35,
        fats: 10,
        isAiUncertain: true
      });
      isUncertain = true;
    }
  });

  return { items: foundItems, isUncertain };
}

// POST /weekly-review - Generate historical review, fact isolation, and versioned plan adjustments
router.post('/weekly-review', async (req, res, next) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userLower = username.trim().toLowerCase();

  try {
    const db = await getDbConnection();
    
    // 1. Fetch user data (last 7 days of logs)
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);
    const dateLimitStr = dateLimit.toISOString().split('T')[0];

    const logs = await db.all(
      'SELECT * FROM daily_logs WHERE username = ? AND date >= ? ORDER BY date ASC',
      [userLower, dateLimitStr]
    );

    if (logs.length === 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'No logs found for the past 7 days. Please record some daily metrics before initiating a review.'
      });
    }

    // Load goals and calculate metrics
    const activeGoal = await db.get(
      'SELECT version, targetSleepHours, targetDailyCalories, targetActivityMinutes FROM goals WHERE username = ? AND status = "Active"',
      [userLower]
    ) || { version: 1, targetSleepHours: 8, targetDailyCalories: 2000, targetActivityMinutes: 30 };

    let totalSleep = 0;
    let totalMood = 0;
    let totalEnergy = 0;
    let weights = [];
    let totalCalories = 0;
    let totalActivity = 0;
    const loggedDates = logs.map(l => l.logId);
    
    if (loggedDates.length > 0) {
      const placeholders = loggedDates.map(() => '?').join(',');
      const meals = await db.all(`SELECT correctedEstimates FROM meals WHERE logId IN (${placeholders})`, loggedDates);
      meals.forEach(m => {
        const items = JSON.parse(m.correctedEstimates || '[]');
        totalCalories += items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      });
      const activities = await db.all(`SELECT durationMinutes FROM activities WHERE logId IN (${placeholders})`, loggedDates);
      activities.forEach(a => {
        totalActivity += (a.durationMinutes || 0);
      });
    }

    logs.forEach(l => {
      totalSleep += l.sleepHours || 0;
      totalMood += l.moodScore || 0;
      totalEnergy += l.energyScore || 0;
      if (l.weight) weights.push(l.weight);
    });

    const count = logs.length;
    const stats = {
      avgSleep: Number((totalSleep / count).toFixed(1)),
      avgWeight: Number((weights.reduce((s, w) => s + w, 0) / (weights.length || 1)).toFixed(1)),
      weightChange: Number(((weights[weights.length - 1] || 0) - (weights[0] || 0)).toFixed(1)),
      avgMood: Number((totalMood / count).toFixed(1)),
      avgEnergy: Number((totalEnergy / count).toFixed(1)),
      totalActivityMins: totalActivity,
      avgCalories: Number((totalCalories / count).toFixed(0))
    };

    // 2. Perform RAG Lookup on Knowledge Base
    const matchedArticles = performRagLookup(stats);
    
    // Get plan version increment
    const activePlan = await db.get(
      'SELECT version FROM plans WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1',
      [userLower]
    );
    const nextVersion = activePlan ? activePlan.version + 1 : 1;

    let reviewOutput = null;
    const hasApiKey = !!process.env.GEMINI_API_KEY;

    if (hasApiKey) {
      // MODE A: Live Gemini API review
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
          You are an expert AI Wellness Reviewer.
          Analyze the user's weekly health logs and draft a retrospective review.
          
          Here is the user's factual logged stats for the last 7 days:
          - Average Sleep: ${stats.avgSleep} hours (Target: ${activeGoal.targetSleepHours}h)
          - Average Weight: ${stats.avgWeight} kg (Net Change: ${stats.weightChange}kg)
          - Average Mood Rating: ${stats.avgMood}/10
          - Average Energy Rating: ${stats.avgEnergy}/10
          - Total Physical Activity: ${stats.totalActivityMins} minutes (Target: ${activeGoal.targetActivityMinutes} mins daily)
          - Average Daily Calorie Intake: ${stats.avgCalories} kcal (Target: ${activeGoal.targetDailyCalories} kcal)

          Here is the Curated Wellness Guidance from our Knowledge Base. You MUST use ONLY this guidelines to justify your recommendations:
          ${JSON.stringify(matchedArticles)}

          Respond ONLY with a JSON object, with no markdown formatting or backticks. Follow this exact format:
          {
            "facts": "A bulleted list summarizing raw logs and numbers strictly logged by the user.",
            "interpretations": "A list of observations connecting sleep, energy, weight, or exercise with the retrieved wellness guidelines.",
            "retrospective": "A personal, encouraging weekly summary (2-3 paragraphs) evaluating goals. The user should be able to edit this.",
            "suggestions": [
              {
                "recommendationId": "rec_1",
                "category": "Sleep | Nutrition | Activity | Mood",
                "proposal": "Actionable goal adjustment (e.g. Target sleep 7.5 hours)",
                "evidence": "Clear explanation referencing logged stats and knowledge base guidelines",
                "referencedKbArticleId": "article_id"
              }
            ]
          }

          Safety Rules:
          - DO NOT diagnose any clinical conditions.
          - DO NOT prescribe any treatment, diet, or clinical drugs.
          - DO NOT present recommendations as guaranteed outcomes.
          - Guide users to consult a doctor if inputs suggest severe symptoms.
        `;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        
        let cleanText = responseText;
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        reviewOutput = JSON.parse(cleanText.trim());

      } catch (geminiError) {
        console.error('Gemini API review failed, falling back to local heuristics:', geminiError);
        reviewOutput = generateLocalReview(stats, activeGoal, matchedArticles);
      }
    } else {
      // MODE B: Local Heuristics Simulator
      reviewOutput = generateLocalReview(stats, activeGoal, matchedArticles);
    }

    // 3. Save the proposed plan as "Pending" in the database
    const planId = 'plan_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    // Remove any older Pending plans for this user to avoid clutter
    await db.run('DELETE FROM plans WHERE username = ? AND status = "Pending"', [userLower]);

    // Insert pending plan
    await db.run(
      `INSERT INTO plans (planId, username, version, status, suggestions, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        planId,
        userLower,
        nextVersion,
        'Pending',
        JSON.stringify(reviewOutput.suggestions || []),
        createdAt
      ]
    );

    await db.close();

    return res.json({
      success: true,
      aiMode: hasApiKey ? 'Gemini 1.5 Flash' : 'Local Heuristics Simulator',
      planId,
      version: nextVersion,
      facts: reviewOutput.facts,
      interpretations: reviewOutput.interpretations,
      retrospective: reviewOutput.retrospective,
      suggestions: reviewOutput.suggestions,
      referencedArticles: matchedArticles
    });

  } catch (error) {
    next(error);
  }
});

// Helper for generating structured review reports locally
function generateLocalReview(stats, goal, articles) {
  const factsList = [
    `Average logged sleep duration was ${stats.avgSleep} hours (Target: ${goal.targetSleepHours}h).`,
    `Average calorie intake was ${stats.avgCalories} kcal (Target: ${goal.targetDailyCalories} kcal).`,
    `Physical activity totaled ${stats.totalActivityMins} minutes (Daily Target: ${goal.targetActivityMinutes} mins).`,
    `Weight average logged was ${stats.avgWeight} kg, with a net change of ${stats.weightChange > 0 ? '+' : ''}${stats.weightChange} kg.`,
    `Self-reported energy averaged ${stats.avgEnergy}/10, and mood averaged ${stats.avgMood}/10.`
  ];

  const interpretations = [];
  const suggestions = [];

  // Sleep analysis
  if (stats.avgSleep < 7.0) {
    interpretations.push(`Your average sleep duration of ${stats.avgSleep}h is below the recommended AASM recovery target of 7-9 hours, which can trigger morning fatigue.`);
    suggestions.push({
      recommendationId: 'rec_sleep_1',
      category: 'Sleep',
      proposal: `Adjust daily sleep target to 7.5 hours (shifting wind-down).`,
      evidence: `Your average sleep was ${stats.avgSleep} hours. Setting a realistic 7.5-hour goal and limiting screen time matches sleep hygiene protocols (Reference: kb-sleep-hygiene).`,
      referencedKbArticleId: 'kb-sleep-hygiene'
    });
  } else {
    interpretations.push('Your sleep duration remained strong and aligned with baseline circadian recovery protocols.');
  }

  // Activity analysis
  if (stats.totalActivityMins < 150) {
    interpretations.push(`Physical activity (${stats.totalActivityMins} mins) fell short of the WHO target of 150-300 weekly minutes, which may impact metabolic rate and energy.`);
    suggestions.push({
      recommendationId: 'rec_act_1',
      category: 'Activity',
      proposal: `Target 25 minutes of moderate physical activity daily.`,
      evidence: `Your total activity was ${stats.totalActivityMins} minutes. Incrementally shifting to 25 mins daily helps meet the WHO weekly guideline of 150+ minutes (Reference: kb-daily-movement).`,
      referencedKbArticleId: 'kb-daily-movement'
    });
  } else {
    interpretations.push('Your physical activity exceeded the recommended weekly cardio limits, aiding cardiac endurance.');
  }

  // Energy/Mood analysis
  if (stats.avgEnergy < 6.0 || stats.avgMood < 6.0) {
    interpretations.push(`Fluctuations in mood (${stats.avgMood}/10) and energy (${stats.avgEnergy}/10) align with low sleep and high stress periods.`);
    suggestions.push({
      recommendationId: 'rec_mood_1',
      category: 'Mood',
      proposal: `Integrate a 10-minute deep-breathing window on high-stress days.`,
      evidence: `Your energy was low (${stats.avgEnergy}/10). Adding breathing practices has been shown to lower resting cortisol and stabilize focus (Reference: kb-stress-management).`,
      referencedKbArticleId: 'kb-stress-management'
    });
  }

  // Default nutrition suggestion
  if (suggestions.length === 0) {
    suggestions.push({
      recommendationId: 'rec_nut_1',
      category: 'Nutrition',
      proposal: `Increase post-workout protein replacement.`,
      evidence: `Your weight remained stable (${stats.weightChange}kg change). Fueling muscle recovery within 3 hours post-workout ensures glycogen synthesis (Reference: kb-energy-balance).`,
      referencedKbArticleId: 'kb-energy-balance'
    });
  }

  const retrospective = `This week showed solid commitment to tracking metrics, logging ${factsList.length} distinct data dimensions. Daily nutrition averages sat at ${stats.avgCalories} kcal, which provided a stable caloric foundation. 

However, sleep patterns were highly volatile, averaging ${stats.avgSleep} hours, which correlates with dips in reported afternoon energy. Increasing sleep consistency by restricting late-evening screen exposure remains a key growth area. 

Overall, progress is stable with a weight delta of ${stats.weightChange} kg. Small adjustments to your sleep targets and active minutes will support sustainable wellness results.`;

  return {
    facts: factsList.join('\n'),
    interpretations: interpretations.join('\n'),
    retrospective,
    suggestions
  };
}

export default router;
