module.exports = function handleAnnotation(io, socket) {
  // Relay drawing events to the other participant in the session
  socket.on('annotation-draw', ({ sessionId, drawData }) => {
    socket.to(`session:${sessionId}`).emit('annotation-draw', {
      drawData,
      fromRole: socket.user.role,
    });
  });

  socket.on('annotation-clear', ({ sessionId }) => {
    socket.to(`session:${sessionId}`).emit('annotation-clear');
  });

  socket.on('annotation-undo', ({ sessionId }) => {
    socket.to(`session:${sessionId}`).emit('annotation-undo');
  });
};
