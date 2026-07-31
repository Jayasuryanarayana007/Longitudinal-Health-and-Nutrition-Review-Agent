import { getDbConnection } from '../data/db.js';

/**
 * Seeds a user's database with 14 days of realistic longitudinal health data.
 * @param {string} username 
 */
export async function seedUserLogs(username) {
  const db = await getDbConnection();
  const userLower = username.trim().toLowerCase();
  const createdAt = new Date().toISOString();

  // We generate logs from 14 days ago to 1 day ago
  const logsToSeed = [];
  
  for (let i = 14; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Deliberately skip logging on Day -8 and Day -3 to simulate missing-data gaps
    if (i === 8 || i === 3) {
      continue;
    }

    // Default metric curves
    let weight = 74.2 - (14 - i) * 0.12 + (Math.random() - 0.5) * 0.3; // Gentle downward weight trend
    let sleepHours = 7.2 + (Math.random() - 0.5) * 1.5;
    let moodScore = Math.floor(6 + Math.random() * 3);
    let energyScore = Math.floor(6 + Math.random() * 3);

    // Day -10: Deliberate Inconsistency check: Low sleep but max energy
    if (i === 10) {
      sleepHours = 3.5;
      energyScore = 9;
      moodScore = 9;
    }

    // Day -5: High activity with low calorie intake (will be checked by V3 validation)
    // Day -5 has 130 mins high intensity activity, we will add below

    const logId = `log_seed_${userLower}_${i}`;

    logsToSeed.push({
      logId,
      date: dateStr,
      weight: Number(weight.toFixed(1)),
      sleepHours: Number(sleepHours.toFixed(1)),
      moodScore,
      energyScore,
      meals: getSeedMeals(i),
      activities: getSeedActivities(i)
    });
  }

  // Insert seed logs in a single transaction
  await db.run('BEGIN TRANSACTION');
  try {
    for (const log of logsToSeed) {
      // Insert daily log
      await db.run(
        `INSERT OR REPLACE INTO daily_logs (logId, username, date, weight, sleepHours, moodScore, energyScore, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [log.logId, userLower, log.date, log.weight, log.sleepHours, log.moodScore, log.energyScore, createdAt]
      );

      // Insert meals
      for (const meal of log.meals) {
        const mealId = 'meal_' + Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO meals (mealId, logId, username, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mealId,
            log.logId,
            userLower,
            meal.textInput,
            JSON.stringify(meal.aiEstimates),
            JSON.stringify(meal.correctedEstimates),
            meal.isUserCorrected ? 1 : 0,
            meal.isAiUncertain ? 1 : 0,
            createdAt
          ]
        );
      }

      // Insert activities
      for (const act of log.activities) {
        const activityId = 'act_' + Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO activities (activityId, logId, username, type, durationMinutes, intensity, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            activityId,
            log.logId,
            userLower,
            act.type,
            act.durationMinutes,
            act.intensity,
            createdAt
          ]
        );
      }
    }
    
    // Seed initial goals v1 (superseded) and goals v2 (active) to show goal versioning history
    const goalId1 = 'goal_seed_v1_' + userLower;
    await db.run(
      `INSERT OR REPLACE INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [goalId1, userLower, 1, 8.5, 2200.0, 45, 'Superseded', new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()]
    );

    const goalId2 = 'goal_seed_v2_' + userLower;
    await db.run(
      `INSERT OR REPLACE INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [goalId2, userLower, 2, 8.0, 2000.0, 30, 'Active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    // Seed an archived pending plan to show version history
    const planId = 'plan_seed_archived_' + userLower;
    await db.run(
      `INSERT OR REPLACE INTO plans (planId, username, version, status, suggestions, createdAt, responseAt, userRejectionReason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        userLower,
        1,
        'Rejected',
        JSON.stringify([
          { recommendationId: 'rec_seed_1', category: 'Nutrition', proposal: 'Decrease daily calories to 1800 kcal', evidence: 'To accelerate weight loss rate.', referencedKbArticleId: 'kb-energy-balance' }
        ]),
        new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        'I felt 1800 kcal was too low and made me feel fatigued during workouts.'
      ]
    );

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  } finally {
    await db.close();
  }
}

// Helpers to generate meals for seeding
function getSeedMeals(dayIndex) {
  if (dayIndex % 2 === 0) {
    return [
      {
        textInput: "Had oatmeal with banana and coffee for breakfast, and chicken curry with rice for dinner",
        aiEstimates: [
          { foodItem: "Oatmeal", calories: 150, protein: 6, carbs: 27, fats: 2.5 },
          { foodItem: "Banana", calories: 105, protein: 1, carbs: 27, fats: 0.4 },
          { foodItem: "Chicken Curry", calories: 290, protein: 26, carbs: 8, fats: 16 },
          { foodItem: "Steamed Basmati Rice", calories: 200, protein: 4, carbs: 44, fats: 0.4 }
        ],
        correctedEstimates: [
          { foodItem: "Oatmeal", calories: 150, protein: 6, carbs: 27, fats: 2.5 },
          { foodItem: "Banana", calories: 105, protein: 1, carbs: 27, fats: 0.4 },
          { foodItem: "Chicken Curry", calories: 290, protein: 26, carbs: 8, fats: 16 },
          { foodItem: "Steamed Basmati Rice", calories: 200, protein: 4, carbs: 44, fats: 0.4 }
        ],
        isUserCorrected: false,
        isAiUncertain: false
      }
    ];
  } else {
    // Day -5: Low calorie intake (800 kcal) with high activity (130 mins)
    const isDay5 = dayIndex === 5;
    return [
      {
        textInput: isDay5 ? "Had salad for lunch and black coffee" : "Had 2 rotis with dal tadka and paneer butter masala",
        aiEstimates: isDay5 ? [
          { foodItem: "Caesar Salad", calories: 190, protein: 4, carbs: 8, fats: 16 },
          { foodItem: "Black Coffee", calories: 5, protein: 0.3, carbs: 0, fats: 0 }
        ] : [
          { foodItem: "Roti", calories: 240, protein: 6, carbs: 48, fats: 2 },
          { foodItem: "Dal Tadka", calories: 150, protein: 8, carbs: 22, fats: 3 },
          { foodItem: "Paneer Butter Masala", calories: 360, protein: 12, carbs: 14, fats: 28 }
        ],
        correctedEstimates: isDay5 ? [
          { foodItem: "Caesar Salad", calories: 190, protein: 4, carbs: 8, fats: 16 },
          { foodItem: "Black Coffee", calories: 5, protein: 0.3, carbs: 0, fats: 0 }
        ] : [
          { foodItem: "Roti", calories: 240, protein: 6, carbs: 48, fats: 2 },
          { foodItem: "Dal Tadka", calories: 150, protein: 8, carbs: 22, fats: 3 },
          { foodItem: "Paneer Butter Masala", calories: 360, protein: 12, carbs: 14, fats: 28 }
        ],
        isUserCorrected: false,
        isAiUncertain: false
      }
    ];
  }
}

// Helpers to generate activities for seeding
function getSeedActivities(dayIndex) {
  const list = [];
  if (dayIndex % 3 === 0) {
    list.push({ type: "Running", durationMinutes: 30, intensity: "High" });
  } else if (dayIndex % 3 === 1) {
    list.push({ type: "Walking", durationMinutes: 45, intensity: "Low" });
  }
  
  // Day -5: Add high intensity exercise (130 mins) to match the deficit rule
  if (dayIndex === 5) {
    list.push({ type: "Cycling", durationMinutes: 130, intensity: "High" });
  }
  
  return list;
}
