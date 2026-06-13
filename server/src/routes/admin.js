const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken, requireRole('admin'));

// GET /api/admin/stats — Dashboard overview numbers
router.get('/stats', async (req, res, next) => {
  try {
    const [activeSessions, todaySessions, avgDuration, avgCsat] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM sessions WHERE status = 'active'`),
      db.query(`SELECT COUNT(*) FROM sessions WHERE DATE(created_at) = CURRENT_DATE`),
      db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))::integer as avg_seconds
        FROM sessions WHERE status = 'ended' AND started_at IS NOT NULL AND ended_at IS NOT NULL
        AND DATE(created_at) = CURRENT_DATE
      `),
      db.query(`
        SELECT AVG(predicted_csat)::numeric(3,1) as avg_csat
        FROM session_intelligence
        WHERE processing_status = 'done'
        AND DATE(created_at) = CURRENT_DATE
      `),
    ]);

    res.json({
      activeSessions: parseInt(activeSessions.rows[0].count),
      todaySessions: parseInt(todaySessions.rows[0].count),
      avgDurationSeconds: avgDuration.rows[0].avg_seconds || 0,
      avgCsat: parseFloat(avgCsat.rows[0].avg_csat) || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sessions/live — Active sessions with details
router.get('/sessions/live', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        s.id, s.status, s.customer_name, s.customer_email, s.customer_telegram,
        s.created_at, s.started_at,
        a.name as agent_name, a.email as agent_email,
        EXTRACT(EPOCH FROM (NOW() - s.started_at))::integer as duration_seconds
      FROM sessions s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.status = 'active'
      ORDER BY s.started_at DESC
    `);

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sessions — Session history with filters
router.get('/sessions', async (req, res, next) => {
  try {
    const { status, agentId, from, to, limit = 100, offset = 0 } = req.query;
    const conditions = ['TRUE'];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (agentId) {
      params.push(agentId);
      conditions.push(`s.agent_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`s.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`s.created_at <= $${params.length}`);
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(`
      SELECT
        s.*, a.name as agent_name,
        EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds,
        si.predicted_csat, si.resolution_status, si.overall_sentiment
      FROM sessions s
      LEFT JOIN agents a ON s.agent_id = a.id
      LEFT JOIN session_intelligence si ON s.id = si.session_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/sessions/:id/force-end — Force end any session
router.delete('/sessions/:id/force-end', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type, metadata)
       VALUES ($1, 'admin', 'Admin', 'session_force_ended', '{}')`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
