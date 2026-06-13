import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';

export default function VideoTile({ stream, label, isMuted, isLocal, isCameraOff, fit = 'cover', children }) {
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
          background: '#151516',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          gap: '12px',
          zIndex: 4,
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <VideoOff size={24} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Camera is turned off</span>
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
            objectFit: fit,
            transform: isLocal ? 'scaleX(-1)' : 'none',
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
