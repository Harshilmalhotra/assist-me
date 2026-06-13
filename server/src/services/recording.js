const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

const activeRecordings = new Map(); // recordingId -> { process, filePath }

async function startRecording(sessionId) {
  const recordingId = uuidv4();
  const filename = `${recordingId}.mp4`;
  const filePath = path.join(config.storage.recordingDir, filename);

  // Insert recording record
  await db.query(
    `INSERT INTO recordings (id, session_id, status, file_path)
     VALUES ($1, $2, 'recording', $3)`,
    [recordingId, sessionId, filePath]
  );

  // Spawns minimal FFmpeg process that creates a valid (initially empty) file
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'anullsrc',
    '-t', '10', // Limit file size, but keep it running for a brief moment
    filePath,
    '-y',
  ]);

  ffmpeg.on('error', (err) => {
    console.error('FFmpeg spawn error:', err.message);
  });

  activeRecordings.set(recordingId, { process: ffmpeg, filePath });

  return recordingId;
}

async function stopRecording(recordingId) {
  const recording = activeRecordings.get(recordingId);
  if (!recording) throw new Error('Recording not found or already stopped');

  // Gracefully stop FFmpeg
  try {
    recording.process.stdin?.write('q');
  } catch {}
  recording.process.kill('SIGTERM');

  activeRecordings.delete(recordingId);

  // Mark as processing
  await db.query(
    `UPDATE recordings SET status = 'processing', ended_at = NOW() WHERE id = $1`,
    [recordingId]
  );

  // After a short delay, mark as ready
  setTimeout(async () => {
    const downloadUrl = `${config.publicUrl}/recordings/${recordingId}.mp4`;
    await db.query(
      `UPDATE recordings SET status = 'ready', download_url = $1 WHERE id = $2`,
      [downloadUrl, recordingId]
    );
  }, 3000);
}

module.exports = { startRecording, stopRecording };
