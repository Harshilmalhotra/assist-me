const db = require('../../db');

module.exports = function handleChat(io, socket) {

  socket.on('send-message', async ({ sessionId, content, messageType = 'text' }, callback) => {
    try {
      if (!content || !content.trim()) {
        return callback({ error: 'Message cannot be empty' });
      }

      const senderName = socket.user.name || socket.user.email || 'Participant';

      const result = await db.query(
        `INSERT INTO chat_messages (session_id, sender_role, sender_name, message_type, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [sessionId, socket.user.role, senderName, messageType, content.trim()]
      );

      const message = result.rows[0];

      // Broadcast to entire session room (including sender)
      io.to(`session:${sessionId}`).emit('new-message', message);

      callback({ success: true, message });
    } catch (err) {
      console.error('send-message error:', err);
      callback({ error: 'Failed to send message' });
    }
  });
};
