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
