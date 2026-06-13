const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Handlers
const handleJoin = require('./handlers/join');
const handleMedia = require('./handlers/media');
const handleChat = require('./handlers/chat');
const handleAnnotation = require('./handlers/annotation');
const handleRecording = require('./handlers/recording');

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Middleware: authenticate every socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const inviteToken = socket.handshake.auth.inviteToken;

    if (token) {
      // Agent connecting with their JWT
      try {
        const payload = jwt.verify(token, config.jwt.secret);
        socket.user = { ...payload, role: payload.role };
        return next();
      } catch (err) {
        return next(new Error('INVALID_TOKEN'));
      }
    }

    if (inviteToken) {
      // Customer connecting with invite token
      try {
        const payload = jwt.verify(inviteToken, config.jwt.inviteSecret);
        socket.user = {
          role: 'customer',
          name: socket.handshake.auth.customerName || 'Customer',
          inviteToken,
        };
        return next();
      } catch (err) {
        return next(new Error('INVALID_INVITE'));
      }
    }

    return next(new Error('NO_AUTH'));
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} role=${socket.user.role}`);

    handleJoin(io, socket);
    handleMedia(io, socket);
    handleChat(io, socket);
    handleAnnotation(io, socket);
    handleRecording(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} reason=${reason}`);
    });
  });

  return io;
}

module.exports = setupSocket;
