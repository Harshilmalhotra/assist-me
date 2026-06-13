const config = require('../config');

const transportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: config.mediasoup.announcedIp,
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 800000,
};

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(transportOptions);

  transport.on('dtlsstatechange', (state) => {
    if (state === 'failed' || state === 'closed') {
      console.warn(`Transport DTLS state: ${state}`);
    }
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

module.exports = { createWebRtcTransport };
