import { Router } from 'express';
import { getDbConnection } from '../data/db.js';

const router = Router();

// GET /history - Fetch user chronological logs for trend charts
router.get('/history', async (req, res, next) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    
    // Fetch logs
    const dailyLogs = await db.all(
      'SELECT * FROM daily_logs WHERE username = ? ORDER BY date ASC',
      [username.trim().toLowerCase()]
    );

    // Fetch meals and activities for each log
    for (const log of dailyLogs) {
      log.meals = await db.all('SELECT * FROM meals WHERE logId = ?', [log.logId]);
      log.activities = await db.all('SELECT * FROM activities WHERE logId = ?', [log.logId]);
      
      // Parse JSON strings back to arrays/objects
      for (const meal of log.meals) {
        meal.aiEstimates = JSON.parse(meal.aiEstimates || '[]');
        meal.correctedEstimates = JSON.parse(meal.correctedEstimates || '[]');
      }
    }

    await db.close();
    return res.json({ success: true, logs: dailyLogs });

  } catch (error) {
    next(error);
  }
});

// GET /summaries - Calculate sliding weekly (7d) and monthly (30d) statistics
router.get('/summaries', async (req, res, next) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    const userLower = username.trim().toLowerCase();

    // Get active goals to calculate deviations
    const activeGoal = await db.get(
      'SELECT targetSleepHours, targetDailyCalories, targetActivityMinutes FROM goals WHERE username = ? AND status = "Active"',
      [userLower]
    ) || { targetSleepHours: 8, targetDailyCalories: 2000, targetActivityMinutes: 30 };

    const getStats = async (days) => {
      // Fetch logs in the date window (sliding days from the most recent logged date or today)
      // Standard fitness apps slide back from today (local time). We will calculate relative to the current local time.
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      const dateLimitStr = dateLimit.toISOString().split('T')[0];

      const logs = await db.all(
        'SELECT * FROM daily_logs WHERE username = ? AND date >= ? ORDER BY date ASC',
        [userLower, dateLimitStr]
      );

      if (logs.length === 0) {
        return {
          avgSleep: 0,
          avgWeight: 0,
          weightChange: 0,
          avgMood: 0,
          avgEnergy: 0,
          totalActivityMins: 0,
          avgCalories: 0,
          daysLogged: 0,
          missingDays: []
        };
      }

      // Fetch meals and activities for average calculation
      let totalSleep = 0;
      let totalMood = 0;
      let totalEnergy = 0;
      let weights = [];
      let totalCalories = 0;
      let totalActivity = 0;
      
      const logIds = logs.map(l => l.logId);
      
      if (logIds.length > 0) {
        const placeholders = logIds.map(() => '?').join(',');
        
        const meals = await db.all(
          `SELECT correctedEstimates FROM meals WHERE logId IN (${placeholders})`,
          logIds
        );
        
        meals.forEach(m => {
          const items = JSON.parse(m.correctedEstimates || '[]');
          const sumCalories = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
          totalCalories += sumCalories;
        });

        const activities = await db.all(
          `SELECT durationMinutes FROM activities WHERE logId IN (${placeholders})`,
          logIds
        );
        
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
      const firstWeight = weights[0] || 0;
      const lastWeight = weights[weights.length - 1] || 0;
      const weightChange = lastWeight - firstWeight;
      const avgWeight = weights.reduce((sum, w) => sum + w, 0) / (weights.length || 1);

      // Detect missing data days in the window (sliding 7 days or 30 days)
      const missingDays = [];
      const loggedDates = new Set(logs.map(l => l.date));
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        if (!loggedDates.has(dStr)) {
          missingDays.push(dStr);
        }
      }

      return {
        avgSleep: Number((totalSleep / count).toFixed(1)),
        avgWeight: Number(avgWeight.toFixed(1)),
        weightChange: Number(weightChange.toFixed(1)),
        avgMood: Number((totalMood / count).toFixed(1)),
        avgEnergy: Number((totalEnergy / count).toFixed(1)),
        totalActivityMins: totalActivity,
        avgCalories: Number((totalCalories / count).toFixed(0)),
        daysLogged: count,
        missingDays
      };
    };

    const weekly = await getStats(7);
    const monthly = await getStats(30);

    await db.close();
    return res.json({
      success: true,
      goals: activeGoal,
      weekly,
      monthly
    });

  } catch (error) {
    next(error);
  }
});

// POST / - Log daily metrics with validation checks (BLOCKING if warnings occur)
router.post('/', async (req, res, next) => {
  const {
    username,
    date,
    weight,
    sleepHours,
    moodScore,
    energyScore,
    meals = [], // array of { mealId, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain }
    activities = [] // array of { activityId, type, durationMinutes, intensity }
  } = req.body;

  if (!username || !date) {
    return res.status(400).json({ success: false, message: 'Username and date are required.' });
  }

  const userLower = username.trim().toLowerCase();

  try {
    const db = await getDbConnection();
    await db.get('PRAGMA foreign_keys = ON');

    // 1. DATA-QUALITY BOUNDS VALIDATION (BLOCKING)
    if (sleepHours < 0 || sleepHours > 24) {
      await db.close();
      return res.status(400).json({ success: false, isBlocking: true, message: 'Sleep duration must be between 0 and 24 hours.' });
    }
    if (sleepHours < 4.0 || sleepHours > 12.0) {
      await db.close();
      return res.status(400).json({ success: false, isBlocking: true, message: 'Sleep duration Warning: Logging sleep below 4 hours or above 12 hours is blocked for profile safety.' });
    }

    if (weight < 30.0 || weight > 300.0) {
      await db.close();
      return res.status(400).json({ success: false, isBlocking: true, message: 'Weight must be between 30kg and 300kg.' });
    }

    // Check weight difference within 24 hours (compared to yesterday's date)
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayLog = await db.get(
      'SELECT weight FROM daily_logs WHERE username = ? AND date = ?',
      [userLower, yesterdayStr]
    );

    if (yesterdayLog && yesterdayLog.weight) {
      const weightDiff = Math.abs(weight - yesterdayLog.weight);
      if (weightDiff > 3.0) {
        await db.close();
        return res.status(400).json({
          success: false,
          isBlocking: true,
          message: `Weight Discrepancy: Logged weight (${weight}kg) differs from yesterday's log (${yesterdayLog.weight}kg) by ${weightDiff.toFixed(1)}kg. Fluctuations exceeding 3kg are blocked to prevent entry errors.`
        });
      }
    }

    // Validate mood and energy
    if (moodScore < 1 || moodScore > 10 || energyScore < 1 || energyScore > 10) {
      await db.close();
      return res.status(400).json({ success: false, isBlocking: true, message: 'Mood and energy scores must be integers between 1 and 10.' });
    }

    // 2. INCONSISTENCY DETECTION (BLOCKING)
    // Rule A: Low sleep (<4.5) but maximum energy (>=9)
    if (sleepHours < 4.5 && energyScore >= 9) {
      await db.close();
      return res.status(400).json({
        success: false,
        isBlocking: true,
        message: `Paradoxical Energy: You reported high energy (${energyScore}/10) despite low sleep (${sleepHours}h). Please verify your logs before saving.`
      });
    }

    // Calculate calories in request to run active checks
    const requestCalories = meals.reduce((sum, meal) => {
      const items = meal.correctedEstimates || [];
      return sum + items.reduce((s, it) => s + (Number(it.calories) || 0), 0);
    }, 0);

    if (requestCalories < 0 || requestCalories > 10000) {
      await db.close();
      return res.status(400).json({ success: false, isBlocking: true, message: 'Total calories entered must be between 0 and 10,000 kcal.' });
    }

    // Rule B: High exercise minutes (>120 mins high intensity) with low calorie intake (<1000 kcal)
    const highIntensityDuration = activities
      .filter(a => a.intensity === 'High')
      .reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);

    if (highIntensityDuration > 120 && requestCalories < 1000 && meals.length > 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        isBlocking: true,
        message: 'Extreme Calorie Deficit: You logged over 120 minutes of high-intensity activity with under 1000 kcal of food intake. Please verify your calorie report.'
      });
    }

    // 3. WRITE TO DATABASE
    const logId = 'log_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    await db.run('BEGIN TRANSACTION');

    try {
      // Find if entry already exists on this date to replace
      const existingLog = await db.get(
        'SELECT logId FROM daily_logs WHERE username = ? AND date = ?',
        [userLower, date]
      );

      let targetLogId = logId;
      if (existingLog) {
        targetLogId = existingLog.logId;
        // Clean old meals and activities related to this logId to overwrite
        await db.run('DELETE FROM daily_logs WHERE logId = ?', [targetLogId]);
      }

      // Insert log
      await db.run(
        `INSERT INTO daily_logs (logId, username, date, weight, sleepHours, moodScore, energyScore, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetLogId, userLower, date, weight, sleepHours, moodScore, energyScore, createdAt]
      );

      // Insert meals
      for (const meal of meals) {
        const mealId = meal.mealId || 'meal_' + Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO meals (mealId, logId, username, textInput, aiEstimates, correctedEstimates, isUserCorrected, isAiUncertain, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mealId,
            targetLogId,
            userLower,
            meal.textInput,
            JSON.stringify(meal.aiEstimates || []),
            JSON.stringify(meal.correctedEstimates || []),
            meal.isUserCorrected ? 1 : 0,
            meal.isAiUncertain ? 1 : 0,
            createdAt
          ]
        );
      }

      // Insert activities
      for (const act of activities) {
        const activityId = act.activityId || 'act_' + Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO activities (activityId, logId, username, type, durationMinutes, intensity, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            activityId,
            targetLogId,
            userLower,
            act.type,
            act.durationMinutes,
            act.intensity,
            createdAt
          ]
        );
      }

      await db.run('COMMIT');
      await db.close();
      return res.status(201).json({ success: true, message: 'Daily metrics saved successfully.' });

    } catch (dbError) {
      await db.run('ROLLBACK');
      await db.close();
      throw dbError;
    }

  } catch (error) {
    next(error);
  }
});

export default router;
