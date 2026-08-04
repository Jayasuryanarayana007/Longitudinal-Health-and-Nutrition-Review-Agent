import { Router } from 'express';
import crypto from 'crypto';
import { getDbConnection, ensureUserExists } from '../data/db.js';

const router = Router();

// GET /api/audit/logs - Retrieve chronological audit log records
router.get('/logs', async (req, res, next) => {
  const { username, eventType, limit } = req.query;
  if (!username || !String(username).trim()) {
    return res.status(400).json({ success: false, message: 'Username parameter is required to view isolated audit logs.' });
  }

  const maxLimit = parseInt(limit) || 100;

  let db;
  try {
    db = await getDbConnection();

    let query = 'SELECT * FROM audit_logs';
    const params = [];
    const conditions = [];

    conditions.push('username = ?');
    params.push(String(username).trim().toLowerCase());

    if (eventType && eventType !== 'All') {
      conditions.push('eventType = ?');
      params.push(String(eventType).trim());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(maxLimit);

    const logs = await db.all(query, params);

    // Parse JSON details field for each log item
    const parsedLogs = logs.map(l => {
      let detailsObj = null;
      try {
        detailsObj = JSON.parse(l.details || '{}');
      } catch (e) {
        detailsObj = l.details;
      }
      return {
        ...l,
        details: detailsObj
      };
    });

    return res.json({ success: true, count: parsedLogs.length, auditLogs: parsedLogs });

  } catch (error) {
    next(error);
  } finally {
    if (db) await db.close();
  }
});

// POST /api/audit/simulate-failure - Trigger manual API failure simulators (504 Timeout or 503 Unavailable)
router.post('/simulate-failure', async (req, res, next) => {
  const { username, failureType } = req.body;
  const userStr = String(username || 'system_test').trim().toLowerCase();
  const typeStr = String(failureType || 'timeout504').toLowerCase();

  let db;
  try {
    db = await getDbConnection();
    const canonicalUser = await ensureUserExists(db, userStr);

    const auditId = 'audit_fail_' + crypto.randomUUID();
    const timestamp = new Date().toISOString();

    if (typeStr === 'timeout504') {
      // Log WorkflowFailure event
      await db.run(
        `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          canonicalUser,
          timestamp,
          'WorkflowFailure',
          'Simulated 504 Gateway Timeout error on external service call',
          JSON.stringify({ failureType: 'timeout504', statusCode: 504, SimulatedAt: timestamp })
        ]
      );

      return res.status(504).json({
        success: false,
        statusCode: 504,
        error: 'Gateway Timeout',
        message: 'Simulated 504 Gateway Timeout: External nutrition service took too long to respond. Local fallback engaged.'
      });

    } else if (typeStr === 'unavailable503') {
      // Log WorkflowFailure event
      await db.run(
        `INSERT INTO audit_logs (logId, username, timestamp, eventType, description, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          canonicalUser,
          timestamp,
          'WorkflowFailure',
          'Simulated 503 Service Unavailable error on external integration',
          JSON.stringify({ failureType: 'unavailable503', statusCode: 503, SimulatedAt: timestamp })
        ]
      );

      return res.status(503).json({
        success: false,
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Simulated 503 Service Unavailable: External API endpoint is currently unreachable. Local fallback engaged.'
      });

    } else {
      return res.status(400).json({ success: false, message: 'Invalid failureType. Choose "timeout504" or "unavailable503".' });
    }

  } catch (error) {
    next(error);
  } finally {
    if (db) await db.close();
  }
});

export default router;
