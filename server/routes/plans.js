import { Router } from 'express';
import crypto from 'crypto';
import { getDbConnection } from '../data/db.js';
import { generateRetrospectiveAndPlan } from '../services/aiWellnessAgent.js';

const router = Router();

// GET /api/plans/goals - Retrieve active goals profile for user
router.get('/goals', async (req, res, next) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  let db;
  try {
    db = await getDbConnection();

    let activeGoal = await db.get(
      'SELECT * FROM goals WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1',
      [userStr]
    );

    // If no goal exists yet, create default v1 goal profile
    if (!activeGoal) {
      const goalId = 'goal_' + crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const defaultActivities = [
        { type: 'Walking', durationMinutes: 30, quantity: 5000, unit: 'steps' },
        { type: 'Running', durationMinutes: 20, quantity: 3, unit: 'km' }
      ];

      await db.run(
        `INSERT INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, targetWeight, targetActivities, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [goalId, userStr, 1, 8.0, 2000.0, 50, 75.0, JSON.stringify(defaultActivities), 'Active', createdAt]
      );

      activeGoal = {
        goalId,
        username: userStr,
        version: 1,
        targetSleepHours: 8.0,
        targetDailyCalories: 2000.0,
        targetActivityMinutes: 50,
        targetWeight: 75.0,
        targetActivities: defaultActivities,
        status: 'Active',
        createdAt
      };
    } else {
      // Parse targetActivities JSON
      try {
        activeGoal.targetActivities = JSON.parse(activeGoal.targetActivities || '[]');
      } catch (e) {
        activeGoal.targetActivities = [];
      }
      if (!activeGoal.targetActivities || activeGoal.targetActivities.length === 0) {
        activeGoal.targetActivities = [
          { type: 'Walking', durationMinutes: activeGoal.targetActivityMinutes || 30, quantity: 5000, unit: 'steps' }
        ];
      }
    }

    return res.json({ success: true, goal: activeGoal });

  } catch (error) {
    next(error);
  } finally {
    if (db) await db.close();
  }
});

// POST /api/plans/goals - Write or update custom target goals (version v1 -> v2)
router.post('/goals', async (req, res, next) => {
  const { username, targetSleepHours, targetDailyCalories, targetActivityMinutes, targetWeight, targetActivities } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const sleepVal = parseFloat(targetSleepHours) || 8.0;
  const calsVal = parseFloat(targetDailyCalories) || 2000.0;
  const weightVal = parseFloat(targetWeight) || 75.0;

  // Process multiple target activities array
  let activitiesList = [];
  if (Array.isArray(targetActivities) && targetActivities.length > 0) {
    activitiesList = targetActivities.map(a => ({
      type: String(a.type || 'Workout').trim(),
      durationMinutes: parseInt(a.durationMinutes) || 15,
      quantity: a.quantity ? parseFloat(a.quantity) : null,
      unit: a.unit ? String(a.unit).trim() : 'mins'
    }));
  } else {
    activitiesList = [{ type: 'Workout', durationMinutes: parseInt(targetActivityMinutes) || 30, quantity: null, unit: 'mins' }];
  }

  const totalActMins = activitiesList.reduce((s, a) => s + (a.durationMinutes || 0), 0);

  let db;
  try {
    db = await getDbConnection();
    await db.run('BEGIN TRANSACTION');

    // Get current version
    const currentGoal = await db.get(
      'SELECT version FROM goals WHERE username = ? ORDER BY version DESC LIMIT 1',
      [userStr]
    );

    const newVersion = currentGoal ? currentGoal.version + 1 : 1;

    // Mark previous active goals as Superseded
    await db.run('UPDATE goals SET status = "Superseded" WHERE username = ?', [userStr]);

    // Insert new Active goal version
    const newGoalId = 'goal_' + crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, targetWeight, targetActivities, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newGoalId, userStr, newVersion, sleepVal, calsVal, totalActMins, weightVal, JSON.stringify(activitiesList), 'Active', createdAt]
    );

    await db.run('COMMIT');

    const updatedGoal = await db.get('SELECT * FROM goals WHERE goalId = ?', [newGoalId]);
    try {
      updatedGoal.targetActivities = JSON.parse(updatedGoal.targetActivities || '[]');
    } catch(e) {
      updatedGoal.targetActivities = activitiesList;
    }

    return res.json({ success: true, message: `Goals updated successfully to version v${newVersion}.`, goal: updatedGoal });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    next(error);
  } finally {
    if (db) await db.close();
  }
});

// POST /api/plans/review - Generate AI Weekly Retrospective & RAG Plan Recommendations
router.post('/review', async (req, res, next) => {
  const { username, date } = req.body;
  if (!username || !date) {
    return res.status(400).json({ success: false, message: 'Username and date parameters are required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const baseDateStr = String(date).trim();

  let db;
  try {
    db = await getDbConnection();

    // 1. Fetch Active Goal
    let activeGoal = await db.get(
      'SELECT * FROM goals WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1',
      [userStr]
    );

    // 2. Fetch Weekly Summaries from backend endpoint helper logic
    const baseDate = new Date(baseDateStr);
    const startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];

    const logs = await db.all(
      `SELECT * FROM daily_logs WHERE username = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
      [userStr, startDateStr, baseDateStr]
    );

    let sleepSum = 0, sleepCount = 0, energySum = 0, energyCount = 0, moodSum = 0, moodCount = 0;
    logs.forEach(l => {
      if (l.sleepHours !== null && l.sleepHours !== undefined) { sleepSum += l.sleepHours; sleepCount++; }
      if (l.energyScore !== null && l.energyScore !== undefined) { energySum += l.energyScore; energyCount++; }
      if (l.moodScore !== null && l.moodScore !== undefined) { moodSum += l.moodScore; moodCount++; }
    });

    const weightLogs = logs.filter(l => l.weight !== null && l.weight !== undefined);
    const weightDelta = weightLogs.length >= 2 ? weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight : 0;

    const logIds = logs.map(l => l.logId);
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0;
    let totalActivityMinutes = 0;

    if (logIds.length > 0) {
      const placeholder = logIds.map(() => '?').join(',');
      const meals = await db.all(`SELECT * FROM meals WHERE logId IN (${placeholder})`, logIds);
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
        } catch (e) {}
      });

      const mealDaysCount = daysWithMeals.size || 1;
      totalCalories = Math.round(totalCalories / mealDaysCount);
      totalProtein = parseFloat((totalProtein / mealDaysCount).toFixed(1));
      totalCarbs = parseFloat((totalCarbs / mealDaysCount).toFixed(1));
      totalFats = parseFloat((totalFats / mealDaysCount).toFixed(1));

      const activities = await db.all(`SELECT * FROM activities WHERE logId IN (${placeholder})`, logIds);
      totalActivityMinutes = activities.reduce((s, a) => s + (a.durationMinutes || 0), 0);
    }

    const weeklySummary = {
      sleepAvg: sleepCount > 0 ? parseFloat((sleepSum / sleepCount).toFixed(1)) : 0,
      energyAvg: energyCount > 0 ? parseFloat((energySum / energyCount).toFixed(1)) : 0,
      moodAvg: moodCount > 0 ? parseFloat((moodSum / moodCount).toFixed(1)) : 0,
      weightDelta: parseFloat(weightDelta.toFixed(2)),
      totalActivityMinutes,
      caloriesAvg: totalCalories,
      proteinAvg: totalProtein,
      carbsAvg: totalCarbs,
      fatsAvg: totalFats
    };

    // 3. Generate Review & Plan via AI Agent
    const reviewResult = await generateRetrospectiveAndPlan(userStr, baseDateStr, weeklySummary, activeGoal);

    // Get current plan version
    const currentPlan = await db.get('SELECT version FROM plans WHERE username = ? ORDER BY version DESC LIMIT 1', [userStr]);
    const planVersion = currentPlan ? currentPlan.version + 1 : 1;

    return res.json({
      success: true,
      planVersion,
      facts: reviewResult.facts,
      interpretations: reviewResult.interpretations,
      retrospectiveText: reviewResult.retrospectiveText,
      proposedRecommendations: reviewResult.proposedRecommendations,
      retrievedArticles: reviewResult.retrievedArticles
    });

  } catch (error) {
    next(error);
  } finally {
    if (db) await db.close();
  }
});

// POST /api/plans/approve - Approve proposed plan (v1 -> v2), mark old Superseded, sync goals & write audit
router.post('/approve', async (req, res, next) => {
  const { username, planVersion, suggestions, userModified } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const versionNum = parseInt(planVersion) || 2;

  let db;
  try {
    db = await getDbConnection();
    await db.run('BEGIN TRANSACTION');

    // Mark existing plans as Superseded
    await db.run('UPDATE plans SET status = "Superseded" WHERE username = ?', [userStr]);

    // Insert new Active plan
    const planId = 'plan_' + crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT INTO plans (planId, username, version, status, suggestions, createdAt, responseAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [planId, userStr, versionNum, 'Active', JSON.stringify(suggestions || []), createdAt, createdAt]
    );

    // Sync active goal profile targets if recommendations included target values
    if (suggestions && Array.isArray(suggestions)) {
      const activeGoal = await db.get('SELECT * FROM goals WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1', [userStr]);
      let newSleep = activeGoal ? activeGoal.targetSleepHours : 8.0;
      let newCals = activeGoal ? activeGoal.targetDailyCalories : 2000.0;
      let newAct = activeGoal ? activeGoal.targetActivityMinutes : 30;

      suggestions.forEach(s => {
        if (s.category === 'Sleep' && s.targetValue) newSleep = parseFloat(s.targetValue);
        if (s.category === 'Nutrition' && s.targetValue) newCals = parseFloat(s.targetValue);
        if (s.category === 'Activity' && s.targetValue) newAct = parseInt(s.targetValue);
      });

      const goalVersion = activeGoal ? activeGoal.version + 1 : 1;
      await db.run('UPDATE goals SET status = "Superseded" WHERE username = ?', [userStr]);

      const goalId = 'goal_' + crypto.randomUUID();
      const existingActivitiesStr = activeGoal ? activeGoal.targetActivities : null;
      await db.run(
        `INSERT INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, targetWeight, targetActivities, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [goalId, userStr, goalVersion, newSleep, newCals, newAct, activeGoal ? activeGoal.targetWeight : 75.0, existingActivitiesStr, 'Active', createdAt]
      );
    }

    // Write PlanModification audit log if user edited proposed recommendations
    if (userModified) {
      const auditId = 'audit_' + crypto.randomUUID();
      await db.run(
        `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          userStr,
          createdAt,
          'PlanModification',
          `User modified plan target recommendations before approving version v${versionNum}`,
          JSON.stringify({ planId, version: versionNum, suggestions })
        ]
      );
    }

    await db.run('COMMIT');
    return res.json({ success: true, message: `Plan version v${versionNum} approved and activated successfully!` });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    next(error);
  } finally {
    if (db) await db.close();
  }
});

// POST /api/plans/reject - Reject proposed plan and write audit log
router.post('/reject', async (req, res, next) => {
  const { username, planVersion, userRejectionReason } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const reasonStr = String(userRejectionReason || 'Declined by user.').trim();

  let db;
  try {
    db = await getDbConnection();
    await db.run('BEGIN TRANSACTION');

    const planId = 'plan_rej_' + crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.run(
      `INSERT INTO plans (planId, username, version, status, suggestions, createdAt, responseAt, userRejectionReason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [planId, userStr, parseInt(planVersion) || 1, 'Rejected', JSON.stringify([]), createdAt, createdAt, reasonStr]
    );

    // Audit Event: RejectedRecommendation
    const auditId = 'audit_' + crypto.randomUUID();
    await db.run(
      `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        userStr,
        createdAt,
        'RejectedRecommendation',
        `User rejected proposed plan recommendations`,
        JSON.stringify({ planId, userRejectionReason: reasonStr })
      ]
    );

    await db.run('COMMIT');
    return res.json({ success: true, message: 'Plan recommendation rejected. Current active plan retained.' });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    next(error);
  } finally {
    if (db) await db.close();
  }
});

export default router;
