const { getOrCreateSessionRouter, getSessionData } = require('../../media/router');
const { createWebRtcTransport } = require('../../media/transport');

module.exports = function handleMedia(io, socket) {

  // Step 1: Client requests RTP capabilities of the router
  socket.on('get-rtp-capabilities', async ({ sessionId }, callback) => {
    try {
      const data = await getOrCreateSessionRouter(sessionId);
      callback({ rtpCapabilities: data.router.rtpCapabilities });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 2: Client creates a send transport
  socket.on('create-send-transport', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const { transport, params } = await createWebRtcTransport(data.router);
      data.transports.set(transport.id, transport);

      callback({ params });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 3: Client creates a receive transport
  socket.on('create-recv-transport', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const { transport, params } = await createWebRtcTransport(data.router);
      data.transports.set(transport.id, transport);

      callback({ params });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 4: Client connects their transport (sends DTLS parameters)
  socket.on('connect-transport', async ({ sessionId, transportId, dtlsParameters }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 5: Client starts producing (sending media)
  socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      const producer = await transport.produce({ kind, rtpParameters, appData });
      data.producers.set(producer.id, producer);

      producer.on('transportclose', () => {
        data.producers.delete(producer.id);
      });

      // Notify other participants a new producer is available
      socket.to(`session:${sessionId}`).emit('new-producer', {
        producerId: producer.id,
        kind,
        socketId: socket.id,
        role: socket.user.role,
        appData: producer.appData,
      });

      callback({ id: producer.id });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Step 6: Client starts consuming (receiving another's media)
  socket.on('consume', async ({ sessionId, transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ error: 'Session not found' });

      if (!data.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume this producer' });
      }

      const transport = data.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });

      data.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => data.consumers.delete(consumer.id));
      consumer.on('producerclose', () => {
        data.consumers.delete(consumer.id);
        socket.emit('consumer-closed', { consumerId: consumer.id });
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Producer pause/resume (mute video or audio)
  socket.on('pause-producer', async ({ sessionId, producerId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      const producer = data?.producers.get(producerId);
      if (!producer) return callback({ error: 'Producer not found' });

      await producer.pause();
      socket.to(`session:${sessionId}`).emit('producer-paused', { producerId, socketId: socket.id });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('resume-producer', async ({ sessionId, producerId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      const producer = data?.producers.get(producerId);
      if (!producer) return callback({ error: 'Producer not found' });

      await producer.resume();
      socket.to(`session:${sessionId}`).emit('producer-resumed', { producerId, socketId: socket.id });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Client requests to close a producer (like screen share)
  socket.on('close-producer', async ({ sessionId, producerId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      const producer = data?.producers.get(producerId);
      if (producer) {
        producer.close();
        data.producers.delete(producerId);
      }
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ error: err.message });
    }
  });

  // Request existing producers when joining a room that already has participants
  socket.on('get-producers', async ({ sessionId }, callback) => {
    try {
      const data = getSessionData(sessionId);
      if (!data) return callback({ producers: [] });

      const producers = [];
      data.producers.forEach((producer, id) => {
        producers.push({ producerId: id, kind: producer.kind, appData: producer.appData });
      });

      callback({ producers });
    } catch (err) {
      callback({ error: err.message });
    }
  });
};
