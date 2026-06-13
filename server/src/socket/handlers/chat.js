const db = require('../../db');

module.exports = function handleChat(io, socket) {

  socket.on('send-message', async ({ sessionId, content, messageType = 'text', fileUrl, fileName, fileSize }, callback) => {
    try {
      if (!content || !content.trim()) {
        return callback({ error: 'Message cannot be empty' });
      }

      const senderName = socket.user.name || socket.user.email || 'Participant';

      let message;

      if (messageType === 'file' && fileUrl) {
        // Prevent duplicate insertion: check if file upload route already inserted it
        const existing = await db.query(
          `SELECT * FROM chat_messages WHERE session_id = $1 AND message_type = 'file' AND file_url = $2`,
          [sessionId, fileUrl]
        );
        if (existing.rows.length > 0) {
          message = existing.rows[0];
        } else {
          const result = await db.query(
            `INSERT INTO chat_messages (session_id, sender_role, sender_name, message_type, content, file_url, file_name, file_size)
             VALUES ($1, $2, $3, 'file', $4, $5, $6, $7)
             RETURNING *`,
            [sessionId, socket.user.role, senderName, content.trim(), fileUrl, fileName || null, fileSize || null]
          );
          message = result.rows[0];
        }
      } else {
        const result = await db.query(
          `INSERT INTO chat_messages (session_id, sender_role, sender_name, message_type, content)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [sessionId, socket.user.role, senderName, messageType, content.trim()]
        );
        message = result.rows[0];
      }

      // Broadcast to entire session room (including sender)
      io.to(`session:${sessionId}`).emit('new-message', message);

      callback({ success: true, message });
    } catch (err) {
      console.error('send-message error:', err);
      callback({ error: 'Failed to send message' });
    }
  });
};
