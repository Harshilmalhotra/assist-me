const express = require('express');
const client = require('prom-client');
const db = require('../db');

const router = express.Router();

// Enable default Node.js metrics (CPU, memory, GC, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const activeSessions = new client.Gauge({
  name: 'videosupport_active_sessions',
  help: 'Number of currently active video sessions',
  registers: [register],
});

const totalSessions = new client.Counter({
  name: 'videosupport_sessions_total',
  help: 'Total number of sessions created',
  registers: [register],
});

// Update gauges periodically from the database
async function updateMetrics() {
  try {
    const active = await db.query(`SELECT COUNT(*) FROM sessions WHERE status = 'active'`);
    activeSessions.set(parseInt(active.rows[0].count));

    const total = await db.query(`SELECT COUNT(*) FROM sessions`);
    // Counter cannot be set directly, so we reset and set. But for simple scraping:
    // We can use a Gauge instead for total sessions or just increment it. Let's keep it as Gauge.
    // The instructions say: totalSessions.reset(); (wait, totalSessions is a Counter. Counters do not have reset() in prom-client usually.
    // Let's check: Counter has inc(). If we want total sessions, a Gauge is safer if we overwrite it, or just use a Gauge named videosupport_sessions_total)
  } catch (err) {
    console.error('Metrics update error:', err.message);
  }
}

// Let's implement totalSessions as a Gauge to avoid prom-client Counter reset exception
const totalSessionsGauge = new client.Gauge({
  name: 'videosupport_sessions_total',
  help: 'Total number of sessions created',
  registers: [register],
});

async function updateAllMetrics() {
  try {
    const active = await db.query(`SELECT COUNT(*) FROM sessions WHERE status = 'active'`);
    activeSessions.set(parseInt(active.rows[0].count));

    const total = await db.query(`SELECT COUNT(*) FROM sessions`);
    totalSessionsGauge.set(parseInt(total.rows[0].count));
  } catch (err) {
    console.error('Metrics update error:', err.message);
  }
}

setInterval(updateAllMetrics, 15000);
updateAllMetrics();

// GET /metrics — Prometheus scrape endpoint
router.get('/', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = router;
