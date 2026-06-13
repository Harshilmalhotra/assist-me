import { Mic, MicOff, Video, VideoOff, Circle, PenTool, PhoneOff, MonitorUp, MessageSquare } from 'lucide-react';

export default function CallControls({
  audioMuted,
  videoOff,
  isRecording,
  annotationActive,
  isScreenSharing,
  showRecording = true,
  showAnnotation = true,
  showScreenShare = true,
  chatOpen,
  unreadChatCount = 0,
  isMobile = false,
  onToggleMute,
  onToggleVideo,
  onToggleRecording,
  onToggleAnnotation,
  onToggleScreenShare,
  onToggleChat,
  onEndCall,
}) {
  const iconSize = isMobile ? 14 : 20;

  return (
    <div 
      className="glass-panel animate-fade-in"
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '6px' : '14px',
        padding: isMobile ? '6px 10px' : '10px 22px',
        borderRadius: '40px',
        zIndex: 15,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Audio toggle */}
      <button
        onClick={onToggleMute}
        className="btn-interactive"
        style={buttonStyle(audioMuted, false, false, isMobile)}
        title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {audioMuted ? <MicOff size={iconSize} color="#ef4444" /> : <Mic size={iconSize} />}
      </button>

      {/* Video toggle */}
      <button
        onClick={onToggleVideo}
        className="btn-interactive"
        style={buttonStyle(videoOff, false, false, isMobile)}
        title={videoOff ? 'Start Camera' : 'Stop Camera'}
      >
        {videoOff ? <VideoOff size={iconSize} color="#ef4444" /> : <Video size={iconSize} />}
      </button>

      {/* Screen Share toggle */}
      {showScreenShare && (
        <button
          onClick={onToggleScreenShare}
          className="btn-interactive"
          style={buttonStyle(isScreenSharing, false, true, isMobile)}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <MonitorUp size={iconSize} color={isScreenSharing ? '#3b82f6' : '#fff'} />
        </button>
      )}

      {/* Chat toggle */}
      <button
        onClick={onToggleChat}
        className="btn-interactive"
        style={{
          ...buttonStyle(chatOpen, false, false, isMobile),
          position: 'relative',
        }}
        title={chatOpen ? 'Hide Chat' : 'Show Chat'}
      >
        <MessageSquare size={iconSize} color={chatOpen ? '#22c55e' : '#fff'} />
        {unreadChatCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--color-danger)',
            color: '#fff',
            fontSize: isMobile ? '8px' : '9.5px',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: isMobile ? '13px' : '17px',
            height: isMobile ? '13px' : '17px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Recording toggle */}
      {showRecording && (
        <button
          onClick={onToggleRecording}
          className="btn-interactive"
          style={buttonStyle(isRecording, true, false, isMobile)}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          <Circle size={iconSize} fill={isRecording ? '#ef4444' : 'none'} color={isRecording ? '#ef4444' : '#fff'} />
        </button>
      )}

      {/* Drawing annotation toggle */}
      {showAnnotation && (
        <button
          onClick={onToggleAnnotation}
          className="btn-interactive"
          style={buttonStyle(annotationActive, false, false, isMobile)}
          title={annotationActive ? 'Disable Annotations' : 'Enable Annotations'}
        >
          <PenTool size={iconSize} color={annotationActive ? '#22c55e' : '#fff'} />
        </button>
      )}

      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

      {/* End/Exit Call */}
      <button
        onClick={onEndCall}
        className="btn-interactive"
        style={endButtonStyle(isMobile)}
        title={showRecording ? 'End Call Session' : 'Exit Call'}
      >
        <PhoneOff size={iconSize} />
      </button>
    </div>
  );
}

const buttonStyle = (active, isRecord = false, isScreen = false, isMobile = false) => ({
  background: active
    ? (isRecord ? 'rgba(239, 68, 68, 0.25)' : (isScreen ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.15)'))
    : 'rgba(255, 255, 255, 0.07)',
  color: active ? (isRecord ? '#ef4444' : (isScreen ? '#3b82f6' : '#fff')) : '#ccc',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '50%',
  width: isMobile ? '32px' : '44px',
  height: isMobile ? '32px' : '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  outline: 'none',
});

const endButtonStyle = (isMobile = false) => ({
  background: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: '50%',
  width: isMobile ? '32px' : '44px',
  height: isMobile ? '32px' : '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  outline: 'none',
});

