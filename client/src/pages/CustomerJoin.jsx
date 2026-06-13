import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, ArrowRight } from 'lucide-react';
import api from '../api';

export default function CustomerJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState('validating'); // validating | ready | error
  const [sessionInfo, setSessionInfo] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);

  // Pre-call Lobby Media Settings
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [lobbyStream, setLobbyStream] = useState(null);
  const videoRef = useRef(null);

  // Mobile responsiveness check
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('No invite link found. Please check the link you received.');
      setState('error');
      return;
    }
    api.post('/sessions/validate-invite', { token })
      .then(({ data }) => {
        setSessionInfo(data);
        setName(data.customerName || '');
        setState('ready');
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Invalid or expired invite link');
        setState('error');
      });
  }, [token]);

  // Request preview camera stream
  useEffect(() => {
    if (state === 'ready') {
      if (cameraActive) {
        navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360, facingMode: 'user' },
          audio: true
        })
        .then(stream => {
          setLobbyStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn('Lobby camera preview access denied:', err);
          setCameraActive(false);
        });
      } else {
        if (lobbyStream) {
          lobbyStream.getTracks().forEach(t => t.stop());
          setLobbyStream(null);
        }
      }
    }

    return () => {
      if (lobbyStream) {
        lobbyStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [state, cameraActive]);

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);

    // Stop lobby preview tracks
    if (lobbyStream) {
      lobbyStream.getTracks().forEach(t => t.stop());
    }

    // Store settings for CallRoom
    sessionStorage.setItem('invite_token', token);
    sessionStorage.setItem('customer_name', name.trim());
    sessionStorage.setItem('customer_mic_on', micActive ? 'true' : 'false');
    sessionStorage.setItem('customer_video_on', cameraActive ? 'true' : 'false');

    navigate(`/session/${sessionInfo.sessionId}?token=${token}&name=${encodeURIComponent(name.trim())}`);
  }

  const pulseAnimation = {
    animation: 'pulse 1.5s infinite ease-in-out'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
    }}>
      <div 
        className="glass-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: state === 'ready' ? '860px' : '420px',
          background: 'rgba(28, 28, 35, 0.55)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          borderRadius: 'var(--radius-xl)',
          padding: isMobile ? 'var(--space-6)' : 'var(--space-10)',
          transition: 'all 0.3s ease',
          color: 'var(--color-text-primary)'
        }}
      >
        {state === 'validating' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(23, 23, 23, 0.1)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              margin: '0 auto var(--space-4)',
              animation: 'pulse 1s linear infinite'
            }} />
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Checking your invite link…</p>
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', fontWeight: 'bold', margin: '0 auto var(--space-4)'
            }}>!</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Unable to Join Support Call
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        {state === 'ready' && (
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 'var(--space-8)',
          }}>
            {/* Left Column: Camera Preview Box */}
            <div style={{
              flex: 1.2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                background: '#151516',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '2px solid rgba(255, 255, 255, 0.6)',
              }}>
                {cameraActive && lobbyStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)', // mirror view for user comfort
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.4)',
                    gap: 'var(--space-2)'
                  }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', color: 'rgba(255,255,255,0.3)'
                    }}>
                      <VideoOff size={24} />
                    </div>
                    <span style={{ fontSize: '13px' }}>Your camera is turned off</span>
                  </div>
                )}

                {/* Overlaid preview badge */}
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                  color: '#fff', fontSize: '11px', padding: '4px 8px',
                  borderRadius: '12px', fontWeight: 500, pointerEvents: 'none'
                }}>
                  Lobby Preview
                </div>
              </div>

              {/* Preview controls */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-4)',
              }}>
                <button
                  onClick={() => setMicActive(!micActive)}
                  className="btn-interactive"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: micActive ? 'rgba(23, 23, 23, 0.08)' : 'var(--color-danger-bg)',
                    color: micActive ? 'var(--color-text-primary)' : 'var(--color-danger)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {micActive ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                  onClick={() => setCameraActive(!cameraActive)}
                  className="btn-interactive"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: cameraActive ? 'rgba(23, 23, 23, 0.08)' : 'var(--color-danger-bg)',
                    color: cameraActive ? 'var(--color-text-primary)' : 'var(--color-danger)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={cameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {cameraActive ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            </div>

            {/* Divider for desktop */}
            {!isMobile && (
              <div style={{ width: '1px', background: 'rgba(0,0,0,0.08)', margin: 'var(--space-2) 0' }} />
            )}

            {/* Right Column: Invite Form Info */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '11px', fontWeight: 600,
                color: 'var(--color-success)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 'var(--space-1)',
                display: 'block'
              }}>
                Secure Video Support
              </span>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', lineHeight: 1.2 }}>
                Ready to Join?
              </h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13.5px', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
                Support Agent <strong>{sessionInfo.agentName}</strong> is waiting to receive you on the support channel.
              </p>

              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', fontSize: '13px' }}>
                  What is your name?
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-focus-glow"
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)', fontSize: '14px',
                    background: 'var(--color-background)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontWeight: 500
                  }}
                  placeholder="Enter your full name"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={!name.trim() || joining}
                className="btn-interactive"
                style={{
                  width: '100%', padding: '12px 20px',
                  background: name.trim() ? 'var(--color-accent)' : 'var(--color-border-strong)',
                  color: name.trim() ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                  border: 'none', borderRadius: 'var(--radius-lg)',
                  fontSize: '14px', fontWeight: 600, cursor: name.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
              >
                {joining ? 'Connecting to Room…' : (
                  <>
                    Join Support Session <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div style={{ marginTop: 'var(--space-4)', fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                🔒 This video call is encrypted and run securely. By joining, you consent to sharing camera and mic parameters with the agent.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
