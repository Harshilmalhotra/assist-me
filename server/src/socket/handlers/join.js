const db = require('../../db');
const redis = require('../../redis');
const { getOrCreateSessionRouter } = require('../../media/router');
const config = require('../../config');

module.exports = function handleJoin(io, socket) {

  socket.on('join-session', async ({ sessionId }, callback) => {
    try {
      // Verify session exists and is not ended
      const result = await db.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      const session = result.rows[0];
      if (!session) return callback({ error: 'Session not found' });
      if (session.status === 'ended') return callback({ error: 'Session has ended' });

      // Check reconnect grace window
      const graceKey = `reconnect:${sessionId}:${socket.user.role}`;
      const wasInGrace = await redis.get(graceKey);
      const isReconnect = !!wasInGrace;

      if (isReconnect) {
        await redis.del(graceKey);
        console.log(`Reconnect within grace window: ${socket.user.role} session=${sessionId}`);
      }

      // Join the socket room for this session
      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;

      // Get or create mediasoup router
      await getOrCreateSessionRouter(sessionId);

      // Update session status to active when first participant joins
      if (session.status === 'waiting') {
        await db.query(
          `UPDATE sessions SET status = 'active', started_at = NOW() WHERE id = $1`,
          [sessionId]
        );
      }

      // Log join event (only if not a silent reconnect)
      if (!isReconnect) {
        await db.query(
          `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
           VALUES ($1, $2, $3, 'participant_joined')`,
          [sessionId, socket.user.role, socket.user.name || socket.user.email]
        );
      }

      // Notify other participants
      socket.to(`session:${sessionId}`).emit('participant-joined', {
        socketId: socket.id,
        role: socket.user.role,
        name: socket.user.name || socket.user.email,
        isReconnect,
      });

      callback({ success: true, isReconnect });
    } catch (err) {
      console.error('join-session error:', err);
      callback({ error: 'Failed to join session' });
    }
  });

  socket.on('disconnect', async () => {
    const sessionId = socket.sessionId;
    if (!sessionId) return;

    const graceKey = `reconnect:${sessionId}:${socket.user.role}`;

    // Set reconnect grace window in Redis
    await redis.set(graceKey, '1', 'EX', config.reconnectGraceSeconds);

    // After grace window, treat as a real disconnect
    setTimeout(async () => {
      const stillInGrace = await redis.get(graceKey);
      if (stillInGrace) {
        // Grace window expired without reconnect
        await redis.del(graceKey);

        await db.query(
          `INSERT INTO session_events (session_id, participant_role, participant_name, event_type)
           VALUES ($1, $2, $3, 'participant_left')`,
          [sessionId, socket.user.role, socket.user.name || socket.user.email]
        );

        io.to(`session:${sessionId}`).emit('participant-left', {
          socketId: socket.id,
          role: socket.user.role,
        });
      }
    }, config.reconnectGraceSeconds * 1000);
  });

  // Relay mute requests between participants (client requests server to ask another participant to mute)
  socket.on('request-mute', ({ sessionId, targetSocketId }) => {
    if (!targetSocketId) return;
    io.to(targetSocketId).emit('mute-request', { from: socket.id });
  });
};
