const db = require('../../db');
const { startRecording, stopRecording } = require('../../services/recording');

module.exports = function handleRecording(io, socket) {

  // Only agents/admins can start/stop recording
  socket.on('start-recording', async ({ sessionId }, callback) => {
    if (socket.user.role !== 'agent' && socket.user.role !== 'admin') {
      return callback({ error: 'Only agents can start recording' });
    }

    try {
      const recordingId = await startRecording(sessionId);

      io.to(`session:${sessionId}`).emit('recording-started', {
        recordingId,
        startedBy: socket.user.name,
      });

      await db.query(
        `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
         VALUES ($1, 'agent', $2, 'recording_started')`,
        [sessionId, socket.user.name]
      );

      callback({ success: true, recordingId });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('stop-recording', async ({ sessionId, recordingId }, callback) => {
    if (socket.user.role !== 'agent' && socket.user.role !== 'admin') {
      return callback({ error: 'Only agents can stop recording' });
    }

    try {
      await stopRecording(recordingId);

      io.to(`session:${sessionId}`).emit('recording-stopped', { recordingId });

      await db.query(
        `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
         VALUES ($1, 'agent', $2, 'recording_stopped')`,
        [sessionId, socket.user.name]
      );

      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });
};
