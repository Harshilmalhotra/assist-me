import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { connectSocket, getSocket } from '../socket';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import CallControls from '../components/CallControls';
import AnnotationCanvas from '../components/AnnotationCanvas';
import IntelligenceCard from '../components/IntelligenceCard';
import api from '../api';

export default function CallRoom() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine role from local storage/params
  const agentUser = JSON.parse(localStorage.getItem('agent_user') || 'null');
  const inviteToken = searchParams.get('token') || sessionStorage.getItem('invite_token');
  const isAgent = !!agentUser && !inviteToken;
  const role = isAgent ? (agentUser.role || 'agent') : 'customer';
  
  // Get participant name
  let myName = 'Customer';
  if (isAgent) {
    myName = agentUser.name;
  } else {
    myName = searchParams.get('name') || sessionStorage.getItem('customer_name') || 'Customer';
  }

  // State
  const [status, setStatus] = useState('connecting'); // connecting | active | ended | error
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [annotationActive, setAnnotationActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [messages, setMessages] = useState([]);

  // Refs for WebRTC / mediasoup
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({ audio: null, video: null });

  useEffect(() => {
    let socket;

    async function initCall() {
      try {
        // 1. Connect socket
        socket = connectSocket({
          token: isAgent ? localStorage.getItem('agent_token') : undefined,
          inviteToken: !isAgent ? inviteToken : undefined,
          customerName: myName,
        });

        // 2. Wait for connection
        await new Promise((resolve, reject) => {
          if (socket.connected) return resolve();
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });

        // 3. Join session room
        const joinResult = await emitWithAck(socket, 'join-session', { sessionId });
        if (joinResult.error) throw new Error(joinResult.error);

        // 4. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        setLocalStream(stream);

        // 5. Initialize mediasoup Device
        const rtpCapsResult = await emitWithAck(socket, 'get-rtp-capabilities', { sessionId });
        if (rtpCapsResult.error) throw new Error(rtpCapsResult.error);

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapsResult.rtpCapabilities });
        deviceRef.current = device;

        // 6. Create send transport
        const sendTransportParams = await emitWithAck(socket, 'create-send-transport', { sessionId });
        const sendTransport = device.createSendTransport(sendTransportParams.params);
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await emitWithAck(socket, 'connect-transport', {
              sessionId, transportId: sendTransport.id, dtlsParameters,
            });
            callback();
          } catch (e) { errback(e); }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const result = await emitWithAck(socket, 'produce', {
              sessionId, transportId: sendTransport.id, kind, rtpParameters, appData,
            });
            callback({ id: result.id });
          } catch (e) { errback(e); }
        });

        // 7. Create recv transport
        const recvTransportParams = await emitWithAck(socket, 'create-recv-transport', { sessionId });
        const recvTransport = device.createRecvTransport(recvTransportParams.params);
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await emitWithAck(socket, 'connect-transport', {
              sessionId, transportId: recvTransport.id, dtlsParameters,
            });
            callback();
          } catch (e) { errback(e); }
        });

        // 8. Produce local audio and video
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        producersRef.current.audio = await sendTransport.produce({ track: audioTrack });
        producersRef.current.video = await sendTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: { videoGoogleStartBitrate: 1000 },
        });

        // 9. Consume existing producers
        const existingProducers = await emitWithAck(socket, 'get-producers', { sessionId });
        for (const { producerId, kind } of existingProducers.producers) {
          await consumeTrack(socket, producerId, kind);
        }

        // 10. Listen for new producers
        socket.on('new-producer', async ({ producerId, kind }) => {
          await consumeTrack(socket, producerId, kind);
        });

        // 11. Listen for participant events
        socket.on('participant-joined', ({ role: remoteRole, name }) => {
          setRemoteParticipant({ role: remoteRole, name });
        });

        socket.on('participant-left', () => {
          setRemoteParticipant(null);
          setRemoteStream(null);
        });

        // 12. Chat
        socket.on('new-message', (message) => {
          setMessages(prev => [...prev, message]);
        });

        // 13. Recording events
        socket.on('recording-started', ({ recordingId: rId }) => {
          setIsRecording(true);
          setRecordingId(rId);
        });
        socket.on('recording-stopped', () => {
          setIsRecording(false);
        });

        // 14. Session end
        socket.on('session-ended', () => {
          setSessionEnded(true);
          setStatus('ended');
        });

        // Load existing chat messages (Agents only, customers get it in real-time)
        if (isAgent) {
          const { data } = await api.get(`/chat/${sessionId}`);
          setMessages(data.messages);
        }

        setStatus('active');
      } catch (err) {
        console.error('Call init error:', err);
        setStatus('error');
      }
    }

    async function consumeTrack(socket, producerId, kind) {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      try {
        const result = await emitWithAck(socket, 'consume', {
          sessionId,
          transportId: recvTransport.id,
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        if (result.error) return;

        const consumer = await recvTransport.consume({
          id: result.id,
          producerId: result.producerId,
          kind: result.kind,
          rtpParameters: result.rtpParameters,
        });

        if (kind === 'video') {
          const stream = new MediaStream([consumer.track]);
          setRemoteStream(stream);
        } else if (kind === 'audio') {
          const audioEl = document.createElement('audio');
          audioEl.srcObject = new MediaStream([consumer.track]);
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
        }
      } catch (e) {
        console.error('Track consumption failed:', e);
      }
    }

    initCall();

    return () => {
      // Cleanup local streams and transports
      producersRef.current.audio?.close();
      producersRef.current.video?.close();
      localStream?.getTracks().forEach(t => t.stop());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket?.disconnect();
    };
  }, [sessionId]);

  // Poll for intelligence after session ends
  useEffect(() => {
    if (!sessionEnded || !isAgent) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}`);
        if (data.intelligence?.processing_status === 'done') {
          setIntelligence(data.intelligence);
          clearInterval(poll);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [sessionEnded, sessionId, isAgent]);

  // Promisify socket.emit
  function emitWithAck(socket, event, data) {
    return new Promise((resolve) => {
      socket.emit(event, data, (response) => {
        resolve(response);
      });
    });
  }

  async function toggleMute() {
    const audioProducer = producersRef.current.audio;
    if (!audioProducer) return;
    const socket = getSocket();
    if (audioMuted) {
      await audioProducer.resume();
      await emitWithAck(socket, 'resume-producer', { sessionId, producerId: audioProducer.id });
    } else {
      await audioProducer.pause();
      await emitWithAck(socket, 'pause-producer', { sessionId, producerId: audioProducer.id });
    }
    setAudioMuted(!audioMuted);
  }

  async function toggleVideo() {
    const videoProducer = producersRef.current.video;
    if (!videoProducer) return;
    const socket = getSocket();
    if (videoOff) {
      await videoProducer.resume();
      await emitWithAck(socket, 'resume-producer', { sessionId, producerId: videoProducer.id });
    } else {
      await videoProducer.pause();
      await emitWithAck(socket, 'pause-producer', { sessionId, producerId: videoProducer.id });
    }
    setVideoOff(!videoOff);
  }

  async function handleEndCall() {
    if (!window.confirm('End this session for all participants?')) return;
    try {
      await api.delete(`/sessions/${sessionId}/end`);
      setSessionEnded(true);
      setStatus('ended');
    } catch (err) {
      console.error('End call error:', err);
    }
  }

  async function handleStartRecording() {
    const socket = getSocket();
    const result = await emitWithAck(socket, 'start-recording', { sessionId });
    if (result.success) {
      setIsRecording(true);
      setRecordingId(result.recordingId);
    }
  }

  async function handleStopRecording() {
    const socket = getSocket();
    await emitWithAck(socket, 'stop-recording', { sessionId, recordingId });
    setIsRecording(false);
  }

  if (status === 'connecting') {
    return (
      <div style={loadingStyle}>
        <p>Connecting to session support channel…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={loadingStyle}>
        <p style={{ color: 'var(--color-danger)' }}>Failed to establish connection. Please check the invite link or your camera permissions.</p>
        <button onClick={() => navigate('/dashboard')} style={{ marginTop: '16px', padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>
      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Remote video — full size */}
        <div style={{ flex: 1, position: 'relative', background: '#111' }}>
          <VideoTile
            stream={remoteStream}
            label={remoteParticipant ? `${remoteParticipant.name} (${remoteParticipant.role})` : 'Customer'}
            isMuted={false}
            isLocal={false}
            isCameraOff={false}
          >
            {/* Annotation canvas overlay */}
            {isAgent && (
              <AnnotationCanvas
                active={annotationActive}
                sessionId={sessionId}
              />
            )}
            {!remoteParticipant && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#666', fontSize: '14px', zIndex: 1,
              }}>
                Waiting for the customer to join…
              </div>
            )}
          </VideoTile>
        </div>

        {/* Local video — picture-in-picture */}
        <div style={{
          position: 'absolute', bottom: '80px', right: '16px',
          width: '180px', aspectRatio: '16/9',
          background: '#222', borderRadius: '8px', overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.15)',
          zIndex: 8,
        }}>
          <VideoTile
            stream={localStream}
            label={myName}
            isMuted={true}
            isLocal={true}
            isCameraOff={videoOff}
          />
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,0,0,0.7)', borderRadius: '4px',
            padding: '4px 10px', color: '#fff', fontSize: '12px',
            zIndex: 12,
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--color-recording)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            Recording Call
          </div>
        )}

        {/* Call controls — bottom bar */}
        {isAgent && !sessionEnded && (
          <CallControls
            audioMuted={audioMuted}
            videoOff={videoOff}
            isRecording={isRecording}
            annotationActive={annotationActive}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleRecording={isRecording ? handleStopRecording : handleStartRecording}
            onToggleAnnotation={() => setAnnotationActive(a => !a)}
            onEndCall={handleEndCall}
          />
        )}

        {/* Customer controls — simplified */}
        {!isAgent && !sessionEnded && (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.8)', padding: '8px 16px',
            borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 12
          }}>
            <button onClick={toggleMute} style={controlButton(audioMuted)}>
              {audioMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={toggleVideo} style={controlButton(videoOff)}>
              {videoOff ? 'Start camera' : 'Stop camera'}
            </button>
            <button onClick={() => navigate('/')} style={{ ...controlButton(false), background: '#dc2626' }}>
              Exit Call
            </button>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div style={{
        width: '320px', background: 'var(--color-background)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        {sessionEnded && intelligence ? (
          <IntelligenceCard intelligence={intelligence} />
        ) : sessionEnded ? (
          <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-secondary)', fontSize: '13px', margin: 'auto', textAlign: 'center' }}>
            <div style={{
              width: '24px', height: '24px', border: '2px solid #ccc', borderTopColor: '#000',
              borderRadius: '50%', animation: 'pulse 1s linear infinite', margin: '0 auto 12px'
            }} />
            Session ended. Processing AI analysis summaries…
          </div>
        ) : (
          <ChatPanel
            sessionId={sessionId}
            messages={messages}
            myRole={role}
            myName={myName}
            isAgent={isAgent}
          />
        )}
      </div>
    </div>
  );
}

const loadingStyle = {
  height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-secondary)', background: 'var(--color-surface)', fontSize: '14px',
};

const controlButton = (active) => ({
  padding: '6px 14px',
  background: active ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.1)',
  color: active ? '#ef4444' : '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '20px', cursor: 'pointer', fontSize: '12px',
  outline: 'none',
});
