const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const { getSessionData } = require('../media/router');
const { createPlainTransport } = require('../media/transport');

const activeRecordings = new Map(); // recordingId -> { process, filePath, sdpPath, transports, consumers }

async function getFreeUdpPort() {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.on('error', reject);
    socket.bind(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

function createSdpText(videoInfo, audioInfo) {
  let sdp = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=Recording
c=IN IP4 127.0.0.1
t=0 0
`;
  if (videoInfo) {
    const pt = videoInfo.rtpParameters.codecs[0].payloadType;
    const codecName = videoInfo.rtpParameters.codecs[0].mimeType.split('/')[1];
    const clockRate = videoInfo.rtpParameters.codecs[0].clockRate;
    sdp += `m=video ${videoInfo.port} RTP/AVP ${pt}\n`;
    sdp += `a=rtpmap:${pt} ${codecName}/${clockRate}\n`;
    sdp += `a=sendonly\n`;
  }
  if (audioInfo) {
    const pt = audioInfo.rtpParameters.codecs[0].payloadType;
    const codecName = audioInfo.rtpParameters.codecs[0].mimeType.split('/')[1];
    const clockRate = audioInfo.rtpParameters.codecs[0].clockRate;
    const channels = audioInfo.rtpParameters.codecs[0].channels || 2;
    sdp += `m=audio ${audioInfo.port} RTP/AVP ${pt}\n`;
    sdp += `a=rtpmap:${pt} ${codecName}/${clockRate}/${channels}\n`;
    sdp += `a=sendonly\n`;
  }
  return sdp;
}

async function startRecording(sessionId) {
  const data = getSessionData(sessionId);
  if (!data) throw new Error('Session not found for recording');

  // Find customer producers
  let customerVideoProducer = null;
  let customerAudioProducer = null;

  for (const producer of data.producers.values()) {
    const role = producer.appData && producer.appData.role;
    const isShare = producer.appData && producer.appData.share;
    if (role === 'customer' && !isShare) {
      if (producer.kind === 'video') customerVideoProducer = producer;
      if (producer.kind === 'audio') customerAudioProducer = producer;
    }
  }

  if (!customerVideoProducer && !customerAudioProducer) {
    throw new Error('No customer media available to record');
  }

  const recordingId = uuidv4();
  const filename = `${recordingId}.mp4`;
  const filePath = path.join(config.storage.recordingDir, filename);
  const sdpPath = path.join(config.storage.recordingDir, `${recordingId}.sdp`);

  // Insert recording record
  await db.query(
    `INSERT INTO recordings (id, session_id, status, file_path)
     VALUES ($1, $2, 'recording', $3)`,
    [recordingId, sessionId, filePath]
  );

  const transports = [];
  const consumers = [];
  let videoInfo = null;
  let audioInfo = null;

  try {
    if (customerVideoProducer) {
      const videoTransport = await createPlainTransport(data.router);
      transports.push(videoTransport);
      const videoConsumer = await videoTransport.consume({
        producerId: customerVideoProducer.id,
        rtpCapabilities: data.router.rtpCapabilities,
      });
      consumers.push(videoConsumer);

      const ffmpegVideoPort = await getFreeUdpPort();
      await videoTransport.connect({ ip: '127.0.0.1', port: ffmpegVideoPort });

      videoInfo = {
        port: ffmpegVideoPort,
        rtpParameters: videoConsumer.rtpParameters,
      };
    }

    if (customerAudioProducer) {
      const audioTransport = await createPlainTransport(data.router);
      transports.push(audioTransport);
      const audioConsumer = await audioTransport.consume({
        producerId: customerAudioProducer.id,
        rtpCapabilities: data.router.rtpCapabilities,
      });
      consumers.push(audioConsumer);

      const ffmpegAudioPort = await getFreeUdpPort();
      await audioTransport.connect({ ip: '127.0.0.1', port: ffmpegAudioPort });

      audioInfo = {
        port: ffmpegAudioPort,
        rtpParameters: audioConsumer.rtpParameters,
      };
    }

    const sdpText = createSdpText(videoInfo, audioInfo);
    fs.writeFileSync(sdpPath, sdpText);

    const ffmpegArgs = [
      '-protocol_whitelist', 'file,crypto,rtp,udp',
      '-i', sdpPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-strict', '-2',
      '-y', filePath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg spawn error:', err.message);
    });

    activeRecordings.set(recordingId, { process: ffmpeg, filePath, sdpPath, transports, consumers });

    return recordingId;

  } catch (err) {
    console.error('Failed to start recording:', err);
    for (const c of consumers) c.close();
    for (const t of transports) t.close();
    throw err;
  }
}

async function stopRecording(recordingId) {
  const recording = activeRecordings.get(recordingId);
  if (!recording) throw new Error('Recording not found or already stopped');

  try {
    recording.process.stdin?.write('q');
  } catch {}
  recording.process.kill('SIGTERM');

  for (const c of recording.consumers) c.close();
  for (const t of recording.transports) t.close();

  try {
    if (fs.existsSync(recording.sdpPath)) {
      fs.unlinkSync(recording.sdpPath);
    }
  } catch (err) {
    console.error('Failed to delete SDP file:', err);
  }

  activeRecordings.delete(recordingId);

  await db.query(
    `UPDATE recordings SET status = 'processing', ended_at = NOW() WHERE id = $1`,
    [recordingId]
  );

  setTimeout(async () => {
    const downloadUrl = `${config.publicUrl}/recordings/${recordingId}.mp4`;
    await db.query(
      `UPDATE recordings SET status = 'ready', download_url = $1 WHERE id = $2`,
      [downloadUrl, recordingId]
    );
  }, 3000);
}

module.exports = { startRecording, stopRecording };
