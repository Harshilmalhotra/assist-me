import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { X } from 'lucide-react';
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

  // Lobby Pre-join settings
  const preJoinMic = sessionStorage.getItem('customer_mic_on') !== 'false';
  const preJoinVideo = sessionStorage.getItem('customer_video_on') !== 'false';

  // State
  const [status, setStatus] = useState('connecting'); // connecting | active | ended | error
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  // Screen Sharing Streams
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [audioMuted, setAudioMuted] = useState(isAgent ? false : !preJoinMic);
  const [videoOff, setVideoOff] = useState(isAgent ? false : !preJoinVideo);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [annotationActive, setAnnotationActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [messages, setMessages] = useState([]);

  // Mobile responsiveness and sidebar states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showChat, setShowChat] = useState(window.innerWidth > 768);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Refs for WebRTC / mediasoup
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({ audio: null, video: null });
  const screenProducerRef = useRef(null);
  const consumersRef = useRef(new Map());

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setShowChat(false); // Close side chat panel on small screens by default
      } else {
        setShowChat(true); // Always show side panel on larger screens
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear unread badge when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadChatCount(0);
    }
  }, [showChat]);

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

        const audioProducer = await sendTransport.produce({ track: audioTrack });
        const videoProducer = await sendTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: { videoGoogleStartBitrate: 1000 },
        });

        producersRef.current.audio = audioProducer;
        producersRef.current.video = videoProducer;

        // Apply pre-join audio/video mute configurations
        if (!isAgent) {
          if (!preJoinMic) {
            await audioProducer.pause();
            await emitWithAck(socket, 'pause-producer', { sessionId, producerId: audioProducer.id });
          }
          if (!preJoinVideo) {
            await videoProducer.pause();
            await emitWithAck(socket, 'pause-producer', { sessionId, producerId: videoProducer.id });
          }
        }

        // 9. Consume existing producers
        const existingProducers = await emitWithAck(socket, 'get-producers', { sessionId });
        for (const { producerId, kind, appData } of existingProducers.producers) {
          await consumeTrack(socket, producerId, kind, appData);
        }

        // 10. Listen for new producers
        socket.on('new-producer', async ({ producerId, kind, appData }) => {
          await consumeTrack(socket, producerId, kind, appData);
        });

        // 11. Listen for consumer closed events from server
        socket.on('consumer-closed', ({ consumerId }) => {
          const entry = consumersRef.current.get(consumerId);
          if (entry) {
            const { consumer, kind, appData } = entry;
            consumer.close();
            consumersRef.current.delete(consumerId);

            if (appData && appData.share) {
              setRemoteScreenStream(null);
            } else {
              if (kind === 'video') {
                setRemoteStream(null);
              } else if (kind === 'audio') {
                const el = document.getElementById(`audio-${consumerId}`);
                if (el) el.remove();
              }
            }
          }
        });

        // 12. Listen for participant events
        socket.on('participant-joined', ({ role: remoteRole, name }) => {
          setRemoteParticipant({ role: remoteRole, name });
        });

        socket.on('participant-left', () => {
          setRemoteParticipant(null);
          setRemoteStream(null);
          setRemoteScreenStream(null);
        });

        // 13. Chat
        socket.on('new-message', (message) => {
          setMessages(prev => [...prev, message]);
          if (!showChat) {
            setUnreadChatCount(prev => prev + 1);
          }
        });

        // 14. Recording events
        socket.on('recording-started', ({ recordingId: rId }) => {
          setIsRecording(true);
          setRecordingId(rId);
        });
        socket.on('recording-stopped', () => {
          setIsRecording(false);
        });

        // 15. Session end
        socket.on('session-ended', () => {
          setSessionEnded(true);
          setStatus('ended');
        });

        // Load existing chat messages (Agents only)
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

    async function consumeTrack(socket, producerId, kind, appData) {
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

        // Track active consumers
        consumersRef.current.set(consumer.id, { consumer, kind, producerId, appData });

        if (appData && appData.share) {
          const stream = new MediaStream([consumer.track]);
          setRemoteScreenStream(stream);
        } else {
          if (kind === 'video') {
            const stream = new MediaStream([consumer.track]);
            setRemoteStream(stream);
          } else if (kind === 'audio') {
            const audioEl = document.createElement('audio');
            audioEl.id = `audio-${consumer.id}`;
            audioEl.srcObject = new MediaStream([consumer.track]);
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
          }
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
      screenProducerRef.current?.close();
      
      localStream?.getTracks().forEach(t => t.stop());
      localScreenStream?.getTracks().forEach(t => t.stop());
      
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();

      consumersRef.current.forEach(({ consumer, kind }) => {
        consumer.close();
        if (kind === 'audio') {
          const el = document.getElementById(`audio-${consumer.id}`);
          if (el) el.remove();
        }
      });
      consumersRef.current.clear();

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

  async function handleToggleScreenShare() {
    if (isScreenSharing) {
      await handleStopScreenShare();
    } else {
      await handleStartScreenShare();
    }
  }

  async function handleStartScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      track.onended = () => {
        handleStopScreenShare();
      };

      const socket = getSocket();
      const screenProducer = await sendTransportRef.current.produce({
        track,
        appData: { share: true },
      });

      screenProducerRef.current = screenProducer;
      setLocalScreenStream(stream);
      setIsScreenSharing(true);
    } catch (err) {
      console.error('Failed to share screen:', err);
    }
  }

  async function handleStopScreenShare() {
    const screenProducer = screenProducerRef.current;
    if (screenProducer) {
      const socket = getSocket();
      screenProducer.close();
      await emitWithAck(socket, 'close-producer', { sessionId, producerId: screenProducer.id });
      screenProducerRef.current = null;
    }

    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
    }
    setIsScreenSharing(false);
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

  async function handleExitCall() {
    if (!window.confirm('Are you sure you want to leave this call?')) return;
    navigate('/');
  }

  if (status === 'connecting') {
    return (
      <div style={loadingStyle}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'pulse 1s linear infinite',
          marginBottom: 'var(--space-4)'
        }} />
        <p>Connecting to secure support line…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={loadingStyle}>
        <p style={{ color: 'var(--color-danger)', fontWeight: 500 }}>Failed to establish connection. Check your internet or invite link permissions.</p>
        <button 
          onClick={() => navigate(isAgent ? '/dashboard' : '/')} 
          className="btn-interactive"
          style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-accent)', color: 'var(--color-accent-text)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const hasActiveScreenShare = !!localScreenStream || !!remoteScreenStream;
  const activeScreenStream = localScreenStream || remoteScreenStream;
  const screenShareLabel = localScreenStream ? 'Your Screen Share' : (remoteParticipant ? `${remoteParticipant.name}'s Screen` : "Participant's Screen");

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }}>
      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* Main Video Box */}
        <div style={{ flex: 1, position: 'relative', background: '#0f0f10' }}>
          {hasActiveScreenShare ? (
            // Screen Share takes main focus
            <VideoTile
              stream={activeScreenStream}
              label={screenShareLabel}
              isMuted={true}
              isLocal={!!localScreenStream}
              isCameraOff={false}
            />
          ) : (
            // Remote participant webcam is main focus
            <VideoTile
              stream={remoteStream}
              label={remoteParticipant ? `${remoteParticipant.name} (${remoteParticipant.role})` : 'Waiting for participant…'}
              isMuted={false}
              isLocal={false}
              isCameraOff={false}
            >
              {/* Annotation canvas overlay */}
              <AnnotationCanvas
                active={annotationActive}
                sessionId={sessionId}
              />
              {!remoteParticipant && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)', fontSize: '14px', zIndex: 1,
                  gap: '12px'
                }}>
                  <div style={{
                    width: '36px', height: '36px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderTopColor: 'rgba(255,255,255,0.6)',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s infinite linear'
                  }} />
                  Waiting for customer to join…
                </div>
              )}
            </VideoTile>
          )}
        </div>

        {/* Small floating webcam tiles overlay (PIP style) */}
        {hasActiveScreenShare ? (
          // Two PIP feeds when screen sharing
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 8,
          }}>
            {/* Remote camera pip */}
            {remoteStream && (
              <div style={{
                width: isMobile ? '120px' : '180px',
                aspectRatio: '16/9',
                background: '#222',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}>
                <VideoTile
                  stream={remoteStream}
                  label={remoteParticipant ? remoteParticipant.name : 'Customer'}
                  isMuted={false}
                  isLocal={false}
                  isCameraOff={false}
                />
              </div>
            )}

            {/* Local camera pip */}
            <div style={{
              width: isMobile ? '120px' : '180px',
              aspectRatio: '16/9',
              background: '#222',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}>
              <VideoTile
                stream={localStream}
                label={myName}
                isMuted={true}
                isLocal={true}
                isCameraOff={videoOff}
              />
            </div>
          </div>
        ) : (
          // Standard single PIP feed (local camera)
          <div style={{
            position: 'absolute',
            bottom: isMobile ? '92px' : '100px',
            right: '20px',
            width: isMobile ? '130px' : '180px',
            aspectRatio: '16/9',
            background: '#222',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.15)',
            zIndex: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <VideoTile
              stream={localStream}
              label={myName}
              isMuted={true}
              isLocal={true}
              isCameraOff={videoOff}
            />
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div style={{
            position: 'absolute', top: '20px', left: '20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            borderRadius: '20px',
            padding: '6px 12px', color: '#fff', fontSize: '11px',
            fontWeight: 600, zIndex: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--color-recording)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            RECORDING ON
          </div>
        )}

        {/* Unified premium Call Controls */}
        {!sessionEnded && (
          <CallControls
            audioMuted={audioMuted}
            videoOff={videoOff}
            isRecording={isRecording}
            annotationActive={annotationActive}
            isScreenSharing={isScreenSharing}
            showRecording={isAgent}
            showAnnotation={isAgent}
            showScreenShare={true}
            chatOpen={showChat}
            unreadChatCount={unreadChatCount}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleRecording={isRecording ? handleStopRecording : handleStartRecording}
            onToggleAnnotation={() => setAnnotationActive(a => !a)}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleChat={() => setShowChat(!showChat)}
            onEndCall={isAgent ? handleEndCall : handleExitCall}
          />
        )}
      </div>

      {/* Right Sidebar (Desktop side pane / Mobile bottom drawer overlay) */}
      {showChat && (
        <div 
          className={isMobile ? "animate-slide-up" : "animate-slide-in-right"}
          style={isMobile ? {
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            background: 'var(--color-background)',
            display: 'flex',
            flexDirection: 'column',
          } : {
            width: '340px',
            background: 'var(--color-background)',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Mobile Overlay Header */}
          {isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Session Support Chat</span>
              <button
                onClick={() => setShowChat(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-secondary)', padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
      )}
    </div>
  );
}

const loadingStyle = {
  height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  color: '#ffffff', background: '#0a0a0a', fontSize: '14px',
};
