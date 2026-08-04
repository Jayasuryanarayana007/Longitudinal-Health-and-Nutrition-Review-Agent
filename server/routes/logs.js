import { Router } from 'express';
import crypto from 'crypto';
import { getDbConnection, ensureUserExists } from '../data/db.js';
import { validateLogBoundaries, checkInconsistencies, detectMissingDays } from '../utils/validationEngine.js';
import { extractMealData } from '../services/mealExtractionService.js';

const router = Router();

import { checkMedicalSafety } from '../utils/medicalSafetyFilter.js';

// POST /extract-meal - Extract nutrition data from free-text using External REST API
router.post('/extract-meal', async (req, res, next) => {
  const { textInput, username } = req.body;
  if (!textInput || !String(textInput).trim()) {
    return res.status(400).json({ success: false, message: 'Meal text input is required.' });
  }

  // Medical Safety Boundary Filter Check
  const safetyCheck = checkMedicalSafety(textInput);
  if (safetyCheck.isClinicalQuery) {
    // Log MedicalSafetyBypass audit event
    let db;
    try {
      db = await getDbConnection();
      const auditId = 'audit_med_' + crypto.randomUUID();
      await db.run(
        `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          username ? String(username).trim().toLowerCase() : 'system_safety',
          new Date().toISOString(),
          'MedicalSafetyBypass',
          'Clinical query or medical advice request intercepted by Safety Refusal Filter',
          JSON.stringify({ textInput: String(textInput).trim(), matchedTerms: safetyCheck.matchedTerms, disclaimer: safetyCheck.disclaimer })
        ]
      );
    } catch (e) {
      console.error('Failed to log MedicalSafetyBypass:', e);
    } finally {
      if (db) await db.close();
    }

    return res.status(400).json({
      success: false,
      isMedicalRefusal: true,
      message: safetyCheck.disclaimer,
      disclaimer: safetyCheck.disclaimer
    });
  }

  try {
    const extracted = await extractMealData(textInput);
    return res.json({
      success: true,
      textInput: String(textInput).trim(),
      items: extracted.items,
      isAiUncertain: extracted.isAiUncertain
    });
  } catch (error) {
    next(error);
  }
});

// POST / - Save or Update a daily log entry (weight, height, sleep, mood, energy, meals, activities)
router.post('/', async (req, res, next) => {
  const { username, date, weight, height, sleepHours, moodScore, energyScore, meals, activities } = req.body;

  if (!username || !date) {
    return res.status(400).json({ success: false, message: 'Username and Date are required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const dateStr = String(date).trim(); // YYYY-MM-DD format

  // Date validation (must not be in the future)
  const logDate = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Allow log for today
  if (isNaN(logDate.getTime()) || logDate > today) {
    return res.status(400).json({ success: false, message: 'Log Date must be a valid date in the past or today.' });
  }

  // Parse and validate numeric fields
  // Use explicit null/undefined/empty checks to avoid treating 0 as "not provided"
  const weightVal = (weight !== null && weight !== undefined && weight !== '') ? parseFloat(weight) : null;
  const heightVal = (height !== null && height !== undefined && height !== '') ? parseFloat(height) : null;
  const sleepVal = (sleepHours !== null && sleepHours !== undefined && sleepHours !== '') ? parseFloat(sleepHours) : null;
  const moodVal = (moodScore !== null && moodScore !== undefined && moodScore !== '') ? parseInt(moodScore) : null;
  const energyVal = (energyScore !== null && energyScore !== undefined && energyScore !== '') ? parseInt(energyScore) : null;

  // Boundary validation check
  const boundaryError = validateLogBoundaries(req.body);
  if (boundaryError) {
    return res.status(400).json({ success: false, message: boundaryError });
  }

  // Cross-metric inconsistency evaluation
  const inconsistencyResult = await checkInconsistencies(userStr, req.body);
  if (inconsistencyResult.blockingError) {
    return res.status(400).json({ success: false, message: inconsistencyResult.blockingError });
  }

  // Validate Meals
  if (meals && !Array.isArray(meals)) {
    return res.status(400).json({ success: false, message: 'Meals must be an array.' });
  }
  if (meals) {
    for (const m of meals) {
      if (!m.textInput) {
        return res.status(400).json({ success: false, message: 'Each meal must have a name.' });
      }
      if (m.items && Array.isArray(m.items)) {
        for (const item of m.items) {
          if (!item.foodItem || isNaN(parseFloat(item.calories)) || parseFloat(item.calories) < 0) {
            return res.status(400).json({ success: false, message: 'Each meal item must have a food name and positive calorie count.' });
          }
        }
      }
    }
  }

  // Validate Activities
  if (activities && !Array.isArray(activities)) {
    return res.status(400).json({ success: false, message: 'Activities must be an array.' });
  }
  if (activities) {
    for (const act of activities) {
      if (!act.type || isNaN(parseInt(act.durationMinutes)) || parseInt(act.durationMinutes) <= 0) {
        return res.status(400).json({ success: false, message: 'Workouts must have a type and positive duration.' });
      }
      if (act.quantity && (isNaN(parseFloat(act.quantity)) || parseFloat(act.quantity) <= 0)) {
        return res.status(400).json({ success: false, message: 'Workout quantity must be a positive number.' });
      }
    }
  }

  let db;
  try {
    db = await getDbConnection();
    const canonicalUser = await ensureUserExists(db, userStr);

    await db.run('BEGIN TRANSACTION');

    // Check if log already exists for this user and date
    let existingLog = await db.get(
      'SELECT logId FROM daily_logs WHERE username = ? AND date = ?',
      [canonicalUser, dateStr]
    );

    let logId;
    if (existingLog) {
      logId = existingLog.logId;
      // Update existing daily log
      await db.run(
        `UPDATE daily_logs 
         SET weight = ?, height = ?, sleepHours = ?, moodScore = ?, energyScore = ?
         WHERE logId = ?`,
        [weightVal, heightVal, sleepVal, moodVal, energyVal, logId]
      );
      // Cascade delete child meals and activities so we can re-insert clean arrays
      await db.run('DELETE FROM meals WHERE logId = ?', [logId]);
      await db.run('DELETE FROM activities WHERE logId = ?', [logId]);
    } else {
      // Create new daily log
      logId = 'log_' + crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await db.run(
        `INSERT INTO daily_logs (logId, username, date, weight, height, sleepHours, moodScore, energyScore, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, userStr, dateStr, weightVal, heightVal, sleepVal, moodVal, energyVal, createdAt]
      );
    }

    // Insert Meals & Write Audit Logs
    if (meals && meals.length > 0) {
      const createdAt = new Date().toISOString();
      for (const m of meals) {
        const mealId = 'meal_' + crypto.randomUUID();
        const aiEstimatesStr = JSON.stringify(m.aiEstimates || m.items || []);
        const correctedEstimatesStr = JSON.stringify(m.items || []);
        const isUserCorrected = m.isUserCorrected ? 1 : 0;
        const isAiUncertain = m.isAiUncertain ? 1 : 0;

        await db.run(
          `INSERT INTO meals (mealId, logId, username, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mealId, logId, userStr, m.textInput || 'Meal Entry', aiEstimatesStr, correctedEstimatesStr, isUserCorrected, isAiUncertain, createdAt]
        );

        // Audit Event 1: UserCorrection event
        if (isUserCorrected === 1) {
          const auditId = 'audit_' + crypto.randomUUID();
          await db.run(
            `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              userStr,
              createdAt,
              'UserCorrection',
              `User corrected AI meal estimates for "${m.textInput || 'Meal'}"`,
              JSON.stringify({
                mealId,
                textInput: m.textInput,
                originalAiEstimates: m.aiEstimates || [],
                userCorrectedEstimates: m.items || []
              })
            ]
          );
        }

        // Audit Event 2: AIUncertainty event
        if (isAiUncertain === 1) {
          const auditId = 'audit_' + crypto.randomUUID();
          await db.run(
            `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              userStr,
              createdAt,
              'AIUncertainty',
              `AI parsing flagged uncertainty for meal "${m.textInput || 'Meal'}"`,
              JSON.stringify({
                mealId,
                textInput: m.textInput,
                aiEstimates: m.items || []
              })
            ]
          );
        }
      }
    }

    // Insert Activities
    if (activities && activities.length > 0) {
      const createdAt = new Date().toISOString();
      for (const act of activities) {
        const activityId = 'act_' + crypto.randomUUID();
        await db.run(
          `INSERT INTO activities (activityId, logId, username, type, durationMinutes, quantity, unit, intensity, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [activityId, logId, userStr, act.type.trim(), parseInt(act.durationMinutes), act.quantity ? parseFloat(act.quantity) : null, act.unit ? act.unit.trim() : null, act.intensity || 'Medium', createdAt]
        );
      }
    }

    await db.run('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Daily logs saved successfully.',
      logId,
      warnings: inconsistencyResult.warnings || []
    });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    next(error);
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// GET /summaries - Calculate Weekly (7-day) and Monthly (30-day) trend aggregates
router.get('/summaries', async (req, res, next) => {
  const { username, date } = req.query;

  if (!username || !date) {
    return res.status(400).json({ success: false, message: 'Username and date parameters are required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const baseDateStr = String(date).trim(); // YYYY-MM-DD

  let db;
  try {
    db = await getDbConnection();

    // Helper function to fetch and compute summaries for N days in the past
    const getSummaryForPeriod = async (daysCount) => {
      // Find boundary dates
      const baseDate = new Date(baseDateStr);
      const startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() - (daysCount - 1));

      const startDateStr = startDate.toISOString().split('T')[0];

      // Query daily logs in range
      const logs = await db.all(
        `SELECT * FROM daily_logs 
         WHERE username = ? AND date >= ? AND date <= ?
         ORDER BY date ASC`,
        [userStr, startDateStr, baseDateStr]
      );

      if (logs.length === 0) {
        return {
          sleepAvg: 0,
          moodAvg: 0,
          energyAvg: 0,
          weightDelta: 0,
          totalActivityMinutes: 0,
          caloriesAvg: 0,
          proteinAvg: 0,
          carbsAvg: 0,
          fatsAvg: 0,
          workoutSummaries: []
        };
      }

      // 1. Calculate averages for sleep, mood, energy
      let sleepSum = 0, sleepCount = 0;
      let moodSum = 0, moodCount = 0;
      let energySum = 0, energyCount = 0;

      logs.forEach(log => {
        if (log.sleepHours !== null && log.sleepHours !== undefined) {
          sleepSum += log.sleepHours;
          sleepCount++;
        }
        if (log.moodScore !== null && log.moodScore !== undefined) {
          moodSum += log.moodScore;
          moodCount++;
        }
        if (log.energyScore !== null && log.energyScore !== undefined) {
          energySum += log.energyScore;
          energyCount++;
        }
      });

      // 2. Weight Delta (Latest - Earliest)
      let weightDelta = 0;
      const weightLogs = logs.filter(l => l.weight !== null && l.weight !== undefined);
      if (weightLogs.length >= 2) {
        weightDelta = weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight;
      }

      // Fetch all logs IDs in the range to fetch meals and activities
      const logIds = logs.map(l => l.logId);
      const logIdsPlaceholder = logIds.map(() => '?').join(',');

      // 3. Activities aggregates
      const activities = await db.all(
        `SELECT * FROM activities WHERE logId IN (${logIdsPlaceholder})`,
        logIds
      );

      let totalActivityMinutes = 0;
      const workoutGroups = {}; // Accumulate quantifiable workouts

      activities.forEach(act => {
        totalActivityMinutes += act.durationMinutes;
        const key = act.type.toLowerCase().trim();
        if (!workoutGroups[key]) {
          workoutGroups[key] = { type: act.type, totalQty: 0, unit: act.unit || 'times', sessions: 0 };
        }
        if (act.quantity) {
          workoutGroups[key].totalQty += act.quantity;
        }
        workoutGroups[key].sessions++;
      });

      // 4. Meals & Calorie/Macronutrient aggregates
      const meals = await db.all(
        `SELECT * FROM meals WHERE logId IN (${logIdsPlaceholder})`,
        logIds
      );

      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;
      
      // Keep track of which days had logged meals to divide correctly
      const daysWithMeals = new Set();

      meals.forEach(m => {
        daysWithMeals.add(m.logId);
        try {
          const items = JSON.parse(m.correctedEstimates || '[]');
          items.forEach(item => {
            totalCalories += parseFloat(item.calories || 0);
            totalProtein += parseFloat(item.protein || 0);
            totalCarbs += parseFloat(item.carbs || 0);
            totalFats += parseFloat(item.fats || 0);
          });
        } catch (e) {
          // Ignore parse errors
        }
      });

      const mealDaysCount = daysWithMeals.size || 1; // Prevent division by zero

      return {
        sleepAvg: sleepCount > 0 ? parseFloat((sleepSum / sleepCount).toFixed(1)) : 0,
        moodAvg: moodCount > 0 ? parseFloat((moodSum / moodCount).toFixed(1)) : 0,
        energyAvg: energyCount > 0 ? parseFloat((energySum / energyCount).toFixed(1)) : 0,
        weightDelta: parseFloat(weightDelta.toFixed(2)),
        totalActivityMinutes,
        caloriesAvg: Math.round(totalCalories / mealDaysCount),
        proteinAvg: parseFloat((totalProtein / mealDaysCount).toFixed(1)),
        carbsAvg: parseFloat((totalCarbs / mealDaysCount).toFixed(1)),
        fatsAvg: parseFloat((totalFats / mealDaysCount).toFixed(1)),
        workoutSummaries: Object.values(workoutGroups)
      };
    };

    const weekly = await getSummaryForPeriod(7);
    const monthly = await getSummaryForPeriod(30);

    // Detect missing log days in the past 7 days
    const missingInfo = await detectMissingDays(userStr, baseDateStr);

    // Fetch daily logs history for charts (past 30 days)
    const baseDate = new Date(baseDateStr);
    const start30Date = new Date(baseDate);
    start30Date.setDate(baseDate.getDate() - 29);
    const start30Str = start30Date.toISOString().split('T')[0];

    const dailyLogs = await db.all(
      `SELECT * FROM daily_logs WHERE username = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
      [userStr, start30Str, baseDateStr]
    );

    const logIds = dailyLogs.map(l => l.logId);
    let allMeals = [];
    let allActivities = [];

    if (logIds.length > 0) {
      const placeholder = logIds.map(() => '?').join(',');
      allMeals = await db.all(`SELECT * FROM meals WHERE logId IN (${placeholder})`, logIds);
      allActivities = await db.all(`SELECT * FROM activities WHERE logId IN (${placeholder})`, logIds);
    }

    // Build structured daily history entries for SVG charts
    const dailyHistory = dailyLogs.map(log => {
      const logMeals = allMeals.filter(m => m.logId === log.logId);
      let dayCalories = 0, dayProtein = 0, dayCarbs = 0, dayFats = 0;
      logMeals.forEach(m => {
        try {
          const items = JSON.parse(m.correctedEstimates || '[]');
          items.forEach(item => {
            dayCalories += parseFloat(item.calories || 0);
            dayProtein += parseFloat(item.protein || 0);
            dayCarbs += parseFloat(item.carbs || 0);
            dayFats += parseFloat(item.fats || 0);
          });
        } catch(e) {}
      });

      const logActs = allActivities.filter(a => a.logId === log.logId);
      const dayActivityMins = logActs.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

      return {
        date: log.date,
        weight: log.weight,
        sleepHours: log.sleepHours,
        moodScore: log.moodScore,
        energyScore: log.energyScore,
        calories: dayCalories,
        protein: dayProtein,
        carbs: dayCarbs,
        fats: dayFats,
        activityMinutes: dayActivityMins
      };
    });

    return res.json({
      success: true,
      username: userStr,
      baseDate: baseDateStr,
      missingDays: missingInfo.missingDaysFormatted,
      missingDates: missingInfo.missingDates,
      weekly,
      monthly,
      dailyHistory
    });

  } catch (error) {
    next(error);
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// POST /seed - Generate 14 days of realistic, consistent historical logs for the user
router.post('/seed', async (req, res, next) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userStr = String(username).trim().toLowerCase();

  let db;
  try {
    db = await getDbConnection();
    const canonicalUser = await ensureUserExists(db, userStr);

    await db.run('BEGIN TRANSACTION');

    // Clean slate: delete ALL user data by username (catches orphans from partial failures)
    await db.run('DELETE FROM meals WHERE username = ?', [canonicalUser]);
    await db.run('DELETE FROM activities WHERE username = ?', [canonicalUser]);
    await db.run('DELETE FROM daily_logs WHERE username = ?', [canonicalUser]);

    const today = new Date();
    const createdAt = new Date().toISOString();

    // Loop to insert 14 days of historical logs
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const logId = 'log_seed_' + crypto.randomUUID();

      // Generate consistent weights: 80kg down to 78.5kg with slight noise
      const weight = parseFloat((80.0 - (13 - i) * 0.11 + Math.sin(i) * 0.15).toFixed(1));
      const height = 175.0; // Consistent height
      
      // Generate sleep hours: 6.8 to 8.2 hours
      const sleepHours = parseFloat((7.4 + Math.cos(i) * 0.6).toFixed(1));
      
      // Generate mood & energy: 6 to 9
      const moodScore = 7 + (i % 3 === 0 ? 1 : i % 2 === 0 ? 0 : -1);
      const energyScore = 7 + (i % 4 === 0 ? 1 : i % 3 === 0 ? 0 : -1);

      await db.run(
        `INSERT INTO daily_logs (logId, username, date, weight, height, sleepHours, moodScore, energyScore, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, canonicalUser, dateStr, weight, height, sleepHours, moodScore, energyScore, createdAt]
      );

      // Seed 2 meals per day
      const breakfastId = 'meal_seed_' + crypto.randomUUID();
      const breakfastItems = [
        { foodItem: 'Oatmeal with Almonds', calories: 420, protein: 12, carbs: 65, fats: 10 },
        { foodItem: 'Black Coffee', calories: 5, protein: 0.5, carbs: 0, fats: 0 }
      ];
      await db.run(
        `INSERT INTO meals (mealId, logId, username, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [breakfastId, logId, canonicalUser, 'Oatmeal and coffee for breakfast', JSON.stringify(breakfastItems), JSON.stringify(breakfastItems), 0, 0, createdAt]
      );

      const dinnerId = 'meal_seed_' + crypto.randomUUID();
      // Alternate calorie intakes slightly
      const calorieOffset = (i % 2 === 0) ? 100 : -100;
      const dinnerItems = [
        { foodItem: 'Grilled Chicken Breast', calories: 350, protein: 45, carbs: 0, fats: 8 },
        { foodItem: 'Brown Rice', calories: 250 + calorieOffset, protein: 5, carbs: 50 + (calorieOffset/4), fats: 2 },
        { foodItem: 'Mixed Veggies with Olive Oil', calories: 150, protein: 3, carbs: 12, fats: 10 }
      ];
      await db.run(
        `INSERT INTO meals (mealId, logId, username, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dinnerId, logId, canonicalUser, 'Chicken, rice, and veggies for dinner', JSON.stringify(dinnerItems), JSON.stringify(dinnerItems), 0, 0, createdAt]
      );

      // Seed workouts every other day
      if (i % 2 === 0) {
        const actId = 'act_seed_' + crypto.randomUUID();
        if (i % 4 === 0) {
          // Log walking steps
          await db.run(
            `INSERT INTO activities (activityId, logId, username, type, durationMinutes, quantity, unit, intensity, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [actId, logId, canonicalUser, 'Walking', 45, 10000, 'steps', 'Low', createdAt]
          );
        } else {
          // Log running distance
          await db.run(
            `INSERT INTO activities (activityId, logId, username, type, durationMinutes, quantity, unit, intensity, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [actId, logId, canonicalUser, 'Running', 30, 5, 'km', 'High', createdAt]
          );
        }
      }
    }

    await db.run('COMMIT');
    return res.status(200).json({ success: true, message: 'Successfully seeded 14 days of historical logs, meals, and activities.' });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    next(error);
  } finally {
    if (db) {
      await db.close();
    }
  }
});

export default router;
