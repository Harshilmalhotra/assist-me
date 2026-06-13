const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await db.query(
      'SELECT * FROM agents WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const agent = result.rows[0];
    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
      config.jwt.secret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      agent: { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  res.json({ agent: req.user });
});

module.exports = router;
