const { createRouter } = require('./worker');

// sessionId -> { router, producers: Map, consumers: Map, transports: Map, participants: Map }
const sessionRouters = new Map();

async function getOrCreateSessionRouter(sessionId) {
  if (!sessionRouters.has(sessionId)) {
    const router = await createRouter();
    sessionRouters.set(sessionId, {
      router,
      producers: new Map(),   // producerId -> producer
      consumers: new Map(),   // consumerId -> consumer
      transports: new Map(),  // transportId -> transport
      participants: new Map(), // socketId -> { role, name, producerIds: [] }
    });
  }
  return sessionRouters.get(sessionId);
}

function getSessionData(sessionId) {
  return sessionRouters.get(sessionId) || null;
}

function removeSessionData(sessionId) {
  const data = sessionRouters.get(sessionId);
  if (data) {
    data.producers.forEach(p => { try { p.close(); } catch {} });
    data.consumers.forEach(c => { try { c.close(); } catch {} });
    data.transports.forEach(t => { try { t.close(); } catch {} });
    try { data.router.close(); } catch {}
    sessionRouters.delete(sessionId);
  }
}

module.exports = { getOrCreateSessionRouter, getSessionData, removeSessionData };
