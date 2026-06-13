const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { runSessionIntelligence } = require('../services/intelligence');

const router = express.Router();

// Ensure recordings directory exists
if (!fs.existsSync(config.storage.recordingDir)) {
  fs.mkdirSync(config.storage.recordingDir, { recursive: true });
}

// Multer Storage Configuration for video recording uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.recordingDir);
  },
  filename: (req, file, cb) => {
    const recordingId = req.body.recordingId;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${recordingId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max for video recordings
});

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

// POST /api/recordings/upload - Upload client-side video recording file
router.post('/upload', verifyToken, upload.single('recording'), async (req, res, next) => {
  try {
    const { sessionId, recordingId } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const filePath = req.file.path;
    const downloadUrl = `${config.publicUrl}/recordings/${filename}`;

    // Update recordings table
    await db.query(
      `UPDATE recordings
       SET status = 'ready', file_path = $1, download_url = $2, ended_at = NOW(), file_size = $3
       WHERE id = $4`,
      [filePath, downloadUrl, req.file.size, recordingId]
    );

    // Check if the session is already ended. If so, trigger the intelligence pipeline.
    const sessionRes = await db.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionRes.rows[0]?.status === 'ended') {
      console.log(`Triggering background intelligence for ended session ${sessionId} after recording upload`);
      setImmediate(() => {
        runSessionIntelligence(sessionId).catch(err => {
          console.error('Background intelligence error:', err.message);
        });
      });
    }

    res.json({ success: true, downloadUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
