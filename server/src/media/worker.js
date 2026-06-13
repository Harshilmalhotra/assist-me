const mediasoup = require('mediasoup');
const config = require('../config');

const workers = [];
let workerIndex = 0;

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
    },
  },
];

async function startWorkers() {
  const numWorkers = config.mediasoup.numWorkers;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp'],
      rtcMinPort: config.mediasoup.rtcMinPort,
      rtcMaxPort: config.mediasoup.rtcMaxPort,
    });

    worker.on('died', (err) => {
      console.error('mediasoup worker died:', err);
      process.exit(1);
    });

    workers.push(worker);
    console.log(`mediasoup worker ${i + 1}/${numWorkers} created`);
  }
}

function getNextWorker() {
  const worker = workers[workerIndex % workers.length];
  workerIndex++;
  return worker;
}

async function createRouter() {
  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs });
  return router;
}

module.exports = { startWorkers, createRouter };
