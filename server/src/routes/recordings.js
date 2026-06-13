const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');

const router = express.Router();

router.get('/:sessionId', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 ORDER BY started_at DESC',
      [req.params.sessionId]
    );
    res.json({ recordings: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
