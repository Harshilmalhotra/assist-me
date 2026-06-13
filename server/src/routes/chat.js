const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// GET /api/chat/:sessionId — Get chat history
router.get('/:sessionId', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.sessionId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
