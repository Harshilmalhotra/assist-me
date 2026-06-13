const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

async function startRecording(sessionId) {
  const recordingId = uuidv4();
  const filename = `${recordingId}.webm`;
  const filePath = path.join(config.storage.recordingDir, filename);

  // Insert recording record in DB
  await db.query(
    `INSERT INTO recordings (id, session_id, status, file_path)
     VALUES ($1, $2, 'recording', $3)`,
    [recordingId, sessionId, filePath]
  );

  return recordingId;
}

async function stopRecording(recordingId) {
  await db.query(
    `UPDATE recordings SET status = 'processing', ended_at = NOW() WHERE id = $1`,
    [recordingId]
  );
}

module.exports = { startRecording, stopRecording };
