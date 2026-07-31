import { Router } from 'express';
import { getDbConnection } from '../data/db.js';

const router = Router();

// GET /active - Fetch active plan
router.get('/active', async (req, res, next) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    const activePlan = await db.get(
      'SELECT * FROM plans WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1',
      [username.trim().toLowerCase()]
    );
    await db.close();
    
    // Parse suggestions back to JSON array
    if (activePlan) {
      activePlan.suggestions = JSON.parse(activePlan.suggestions || '[]');
    }

    return res.json({ success: true, activePlan });
  } catch (error) {
    next(error);
  }
});

// GET /history - Fetch all plan versions
router.get('/history', async (req, res, next) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    const plans = await db.all(
      'SELECT * FROM plans WHERE username = ? ORDER BY version DESC',
      [username.trim().toLowerCase()]
    );
    await db.close();

    plans.forEach(p => {
      p.suggestions = JSON.parse(p.suggestions || '[]');
    });

    return res.json({ success: true, plans });
  } catch (error) {
    next(error);
  }
});

// GET /goals/history - Fetch goals version history for user
router.get('/goals/history', async (req, res, next) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    const goals = await db.all(
      'SELECT * FROM goals WHERE username = ? ORDER BY version DESC',
      [username.trim().toLowerCase()]
    );
    await db.close();

    return res.json({ success: true, goals });
  } catch (error) {
    next(error);
  }
});

// POST /approve - Approve a pending plan, increment version, supersede old plan
router.post('/approve', async (req, res, next) => {
  const { username, planId, suggestions } = req.body;
  if (!username || !planId) {
    return res.status(400).json({ success: false, message: 'Username and planId are required.' });
  }

  const userLower = username.trim().toLowerCase();

  try {
    const db = await getDbConnection();
    await db.run('BEGIN TRANSACTION');

    try {
      // Find the pending plan
      const pendingPlan = await db.get(
        'SELECT * FROM plans WHERE planId = ? AND username = ? AND status = "Pending"',
        [planId, userLower]
      );

      if (!pendingPlan) {
        await db.run('ROLLBACK');
        await db.close();
        return res.status(404).json({ success: false, message: 'Pending plan not found.' });
      }

      // Check if user edited the suggestions compared to what the AI proposed
      const originalSuggestions = JSON.parse(pendingPlan.suggestions || '[]');
      const isModified = JSON.stringify(originalSuggestions) !== JSON.stringify(suggestions);

      // Archive any existing Active plans to Superseded
      await db.run(
        'UPDATE plans SET status = "Superseded" WHERE username = ? AND status = "Active"',
        [userLower]
      );

      const responseAt = new Date().toISOString();
      const updatedSuggestionsStr = JSON.stringify(suggestions || []);

      // Activate the pending plan with final suggestions
      await db.run(
        `UPDATE plans 
         SET status = "Active", suggestions = ?, responseAt = ? 
         WHERE planId = ?`,
        [updatedSuggestionsStr, responseAt, planId]
      );

      // If user modified suggestions, log a PlanModification audit log
      if (isModified) {
        const auditLogId = 'audit_' + Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            auditLogId,
            userLower,
            responseAt,
            'PlanModification',
            `User modified plan version V${pendingPlan.version} recommendations before approval.`,
            JSON.stringify({
              planId,
              version: pendingPlan.version,
              before: originalSuggestions,
              after: suggestions
            })
          ]
        );
      }

      await db.run('COMMIT');
      await db.close();
      return res.json({ success: true, message: `Plan version V${pendingPlan.version} approved and activated successfully.` });

    } catch (dbErr) {
      await db.run('ROLLBACK');
      await db.close();
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
});

// POST /reject - Reject a pending plan
router.post('/reject', async (req, res, next) => {
  const { username, planId, userRejectionReason } = req.body;
  if (!username || !planId) {
    return res.status(400).json({ success: false, message: 'Username and planId are required.' });
  }

  const userLower = username.trim().toLowerCase();

  try {
    const db = await getDbConnection();
    
    // Find pending plan
    const pendingPlan = await db.get(
      'SELECT * FROM plans WHERE planId = ? AND username = ? AND status = "Pending"',
      [planId, userLower]
    );

    if (!pendingPlan) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Pending plan not found.' });
    }

    const responseAt = new Date().toISOString();
    
    // Set status to Rejected
    await db.run(
      `UPDATE plans 
       SET status = "Rejected", responseAt = ?, userRejectionReason = ? 
       WHERE planId = ?`,
      [responseAt, userRejectionReason || 'No reason specified', planId]
    );

    // Log RejectedRecommendation audit log
    const auditLogId = 'audit_' + Math.random().toString(36).substr(2, 9);
    await db.run(
      `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        auditLogId,
        userLower,
        responseAt,
        'RejectedRecommendation',
        `User rejected proposed plan version V${pendingPlan.version}.`,
        JSON.stringify({
          planId,
          version: pendingPlan.version,
          reason: userRejectionReason || 'No reason specified',
          suggestions: JSON.parse(pendingPlan.suggestions || '[]')
        })
      ]
    );

    await db.close();
    return res.json({ success: true, message: 'Plan adjustment rejected.' });

  } catch (error) {
    next(error);
  }
});

// POST /goals - Manually update user profile targets, versioning goals
router.post('/goals', async (req, res, next) => {
  const { username, targetSleepHours, targetDailyCalories, targetActivityMinutes } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const userLower = username.trim().toLowerCase();

  try {
    const db = await getDbConnection();
    await db.run('BEGIN TRANSACTION');

    try {
      // Find current active goal
      const currentActiveGoal = await db.get(
        'SELECT version FROM goals WHERE username = ? AND status = "Active" ORDER BY version DESC LIMIT 1',
        [userLower]
      );

      const nextVersion = currentActiveGoal ? currentActiveGoal.version + 1 : 1;
      const createdAt = new Date().toISOString();

      // Supersede current goals
      await db.run(
        'UPDATE goals SET status = "Superseded" WHERE username = ? AND status = "Active"',
        [userLower]
      );

      // Create new active goal
      const goalId = 'goal_' + Math.random().toString(36).substr(2, 9);
      await db.run(
        `INSERT INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goalId,
          userLower,
          nextVersion,
          Number(targetSleepHours) || 8.0,
          Number(targetDailyCalories) || 2000.0,
          Number(targetActivityMinutes) || 30,
          'Active',
          createdAt
        ]
      );

      await db.run('COMMIT');
      await db.close();
      return res.json({
        success: true,
        message: 'Wellness goals updated successfully.',
        activeGoal: {
          version: nextVersion,
          targetSleepHours: Number(targetSleepHours),
          targetDailyCalories: Number(targetDailyCalories),
          targetActivityMinutes: Number(targetActivityMinutes)
        }
      });

    } catch (dbErr) {
      await db.run('ROLLBACK');
      await db.close();
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
