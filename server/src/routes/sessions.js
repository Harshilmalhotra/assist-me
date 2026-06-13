const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { sendInvite } = require('../services/invite');
const { runSessionIntelligence } = require('../services/intelligence');

const router = express.Router();

// Ensure upload directory exists
if (!fs.existsSync(config.storage.uploadDir)) {
  fs.mkdirSync(config.storage.uploadDir, { recursive: true });
}

// Ensure recordings directory exists
if (!fs.existsSync(config.storage.recordingDir)) {
  fs.mkdirSync(config.storage.recordingDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.storage.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Images, PDFs, text, and DOCX only.'));
    }
  },
});

// POST /api/sessions — Agent creates a session
router.post('/', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const { customerName, customerEmail, customerTelegram, customerPhone } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!customerEmail && !customerTelegram && !customerPhone) {
      return res.status(400).json({ error: 'Provide at least one of: customerEmail, customerTelegram, customerPhone' });
    }

    // Generate signed invite token
    const inviteToken = jwt.sign(
      { purpose: 'session-invite', agentId: req.user.id },
      config.jwt.inviteSecret,
      { expiresIn: config.jwt.inviteExpiry }
    );

    const origin = `${req.protocol}://${req.headers.host}`;
    const joinUrl = `${origin}/join?token=${inviteToken}`;

    // Create session in DB
    const result = await db.query(
      `INSERT INTO sessions (agent_id, customer_name, customer_email, customer_telegram, customer_phone, invite_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
       RETURNING *`,
      [req.user.id, customerName, customerEmail || null, customerTelegram || null, customerPhone || null, inviteToken]
    );

    const session = result.rows[0];

    // Log creation event
    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type, metadata)
       VALUES ($1, 'agent', $2, 'session_created', $3)`,
      [session.id, req.user.name, JSON.stringify({ joinUrl })]
    );

    // Send invites (non-blocking)
    sendInvite({
      session,
      joinUrl,
      customerEmail,
      customerTelegram,
      customerPhone,
      customerName,
      agentName: req.user.name
    }).catch(err => {
      console.error('Invite send error:', err.message);
    });

    res.status(201).json({ session, joinUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions — Agent's session list
router.get('/', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const conditions = [req.user.role === 'admin' ? 'TRUE' : 's.agent_id = $1'];
    const params = req.user.role === 'admin' ? [] : [req.user.id];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(
      `SELECT s.*, a.name as agent_name,
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds
       FROM sessions s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id — Single session detail
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, a.name as agent_name,
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::integer as duration_seconds
       FROM sessions s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch intelligence if available
    const intel = await db.query(
      'SELECT * FROM session_intelligence WHERE session_id = $1',
      [req.params.id]
    );

    // Fetch events
    const events = await db.query(
      'SELECT * FROM session_events WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({
      session: result.rows[0],
      intelligence: intel.rows[0] || null,
      events: events.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/validate-invite — Customer validates token before joining
router.post('/validate-invite', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.inviteSecret);
    } catch {
      return res.status(401).json({ error: 'Invite link is invalid or has expired' });
    }

    const result = await db.query(
      `SELECT s.id, s.status, s.customer_name, a.name as agent_name
       FROM sessions s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.invite_token = $1`,
      [token]
    );

    const session = result.rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status === 'ended') {
      return res.status(410).json({ error: 'This session has ended' });
    }

    res.json({
      sessionId: session.id,
      agentName: session.agent_name,
      customerName: session.customer_name,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id/end — Agent ends a session
router.delete('/:id/end', verifyToken, requireRole('agent', 'admin'), async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    await db.query(
      `UPDATE sessions SET status = 'ended', ended_at = NOW()
       WHERE id = $1 AND (agent_id = $2 OR $3 = 'admin')`,
      [sessionId, req.user.id, req.user.role]
    );

    await db.query(
      `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
       VALUES ($1, 'agent', $2, 'session_ended')`,
      [sessionId, req.user.name]
    );

    // Fire intelligence pipeline in background (non-blocking)
    setImmediate(() => {
      runSessionIntelligence(sessionId).catch(err => {
        console.error('Background intelligence error:', err.message);
      });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/upload — Chat file upload
router.post('/:id/upload', verifyToken, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // File URL points to the static endpoint exposed on server
    const fileUrl = `${config.publicUrl}/uploads/${req.file.filename}`;
    const senderName = req.user.name || req.user.email;

    // Save as a chat message
    const result = await db.query(
      `INSERT INTO chat_messages
         (session_id, sender_role, sender_name, message_type, content, file_url, file_name, file_size)
       VALUES ($1, $2, $3, 'file', $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.id,
        req.user.role,
        senderName,
        `Shared a file: ${req.file.originalname}`,
        fileUrl,
        req.file.originalname,
        req.file.size,
      ]
    );

    res.json({ message: result.rows[0], fileUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
