import { Mic, MicOff, Video, VideoOff, Circle, PenTool, PhoneOff } from 'lucide-react';

export default function CallControls({
  audioMuted,
  videoOff,
  isRecording,
  annotationActive,
  onToggleMute,
  onToggleVideo,
  onToggleRecording,
  onToggleAnnotation,
  onEndCall,
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(15, 15, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      padding: '8px 16px',
      borderRadius: '30px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 15,
    }}>
      {/* Audio toggle */}
      <button
        onClick={onToggleMute}
        style={buttonStyle(audioMuted)}
        title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {audioMuted ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      {/* Video toggle */}
      <button
        onClick={onToggleVideo}
        style={buttonStyle(videoOff)}
        title={videoOff ? 'Start Video' : 'Stop Video'}
      >
        {videoOff ? <VideoOff size={18} /> : <Video size={18} />}
      </button>

      {/* Recording toggle */}
      <button
        onClick={onToggleRecording}
        style={buttonStyle(isRecording, true)}
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
      >
        <Circle size={18} fill={isRecording ? '#ef4444' : 'none'} color={isRecording ? '#ef4444' : '#fff'} />
      </button>

      {/* Drawing annotation toggle */}
      <button
        onClick={onToggleAnnotation}
        style={buttonStyle(annotationActive)}
        title={annotationActive ? 'Disable Annotations' : 'Enable Annotations'}
      >
        <PenTool size={18} color={annotationActive ? '#22c55e' : '#fff'} />
      </button>

      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

      {/* End Call */}
      <button
        onClick={onEndCall}
        style={endButtonStyle}
        title="End Session"
      >
        <PhoneOff size={18} />
      </button>
    </div>
  );
}

const buttonStyle = (active, isRecord = false) => ({
  background: active
    ? (isRecord ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.15)')
    : 'transparent',
  color: active ? (isRecord ? '#ef4444' : '#fff') : '#ccc',
  border: 'none',
  borderRadius: '50%',
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background var(--transition-fast)',
  outline: 'none',
});

const endButtonStyle = {
  background: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: '50%',
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background var(--transition-fast)',
  outline: 'none',
};
