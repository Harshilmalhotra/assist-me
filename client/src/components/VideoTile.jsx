import { useEffect, useRef } from 'react';

export default function VideoTile({ stream, label, isMuted, isLocal, isCameraOff, children }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#111',
      overflow: 'hidden',
    }}>
      {isCameraOff ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '14px',
        }}>
          Camera off
        </div>
      ) : stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '14px',
        }}>
          Waiting for stream…
        </div>
      )}

      {/* Children overlay (like drawing canvas) */}
      {children}

      {/* Label */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 5,
      }}>
        {label} {isLocal && '(You)'}
      </div>
    </div>
  );
}
