import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket({ token, inviteToken, customerName }) {
  if (socket?.connected) return socket;

  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  socket = io(socketUrl, {
    auth: { token, inviteToken, customerName },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect_error', (err) => {
    // Log full error object for diagnostics (message, stack, and any extra fields)
    try {
      console.error('Socket connection error:', err);
      console.error('connect_error details:', {
        message: err && err.message,
        name: err && err.name,
        stack: err && err.stack,
        toString: err && err.toString && err.toString(),
        data: err && err.data,
      });
    } catch (logErr) {
      console.error('Failed to stringify connect_error', logErr, err);
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error event:', err);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
