import { Router } from 'express';
import { getDbConnection } from '../data/db.js';

const router = Router();

// GET / - Fetch all audit logs for user
router.get('/', async (req, res, next) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const db = await getDbConnection();
    const audits = await db.all(
      'SELECT * FROM audit_logs WHERE username = ? ORDER BY timestamp DESC',
      [username.trim().toLowerCase()]
    );
    await db.close();

    audits.forEach(a => {
      a.details = JSON.parse(a.details || '{}');
    });

    return res.json({ success: true, auditLogs: audits });
  } catch (error) {
    next(error);
  }
});

// POST /log-manual - Log an audit event manually (for UI pipeline triggers)
router.post('/log-manual', async (req, res, next) => {
  const { username, eventType, description, details } = req.body;
  if (!username || !eventType || !description) {
    return res.status(400).json({ success: false, message: 'username, eventType, and description are required.' });
  }

  const userLower = username.trim().toLowerCase();
  const logId = 'audit_' + Math.random().toString(36).substr(2, 9);
  const timestamp = new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, userLower, timestamp, eventType, description, JSON.stringify(details || {})]
    );
    await db.close();
    return res.status(201).json({ success: true, message: 'Audit event logged.' });
  } catch (error) {
    next(error);
  }
});

// POST /simulate-failure - Simulates a database/pipeline failure state for observability testing
router.post('/simulate-failure', async (req, res, next) => {
  const { username, failureType } = req.body;
  if (!username || !failureType) {
    return res.status(400).json({ success: false, message: 'username and failureType are required.' });
  }

  const userLower = username.trim().toLowerCase();
  const timestamp = new Date().toISOString();
  const logId = 'audit_' + Math.random().toString(36).substr(2, 9);

  try {
    const db = await getDbConnection();
    
    // Log the failure to audit_logs
    await db.run(
      `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        logId,
        userLower,
        timestamp,
        'WorkflowFailure',
        `Simulated pipeline failure triggered: ${failureType}`,
        JSON.stringify({ failureType, status: 'Triggered', environment: 'Development' })
      ]
    );
    await db.close();

    // Trigger responses based on simulation requested
    if (failureType === 'DatabaseTimeout') {
      return res.status(504).json({
        success: false,
        message: 'Database Transaction Timeout: [Simulated SQLite Locking Error after 5000ms]. Fail-safe triggered.'
      });
    }

    if (failureType === 'NetworkLatency') {
      return res.status(503).json({
        success: false,
        message: 'LLM Service Gateway Unavailable: [Simulated Network Disconnect]. Falls back to heuristic pipeline.'
      });
    }

    return res.status(400).json({ success: false, message: `Unknown failure type: ${failureType}` });

  } catch (error) {
    next(error);
  }
});

export default router;
