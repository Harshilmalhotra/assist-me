import { useEffect } from 'react';

export default function FilePreview({ fileUrl, fileType, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="dialog" aria-modal="true">
      <div style={{ maxWidth: '90%', maxHeight: '90%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        {fileType && fileType.startsWith('image') ? (
          <img src={fileUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
        ) : fileType && fileType.startsWith('video') ? (
          <video src={fileUrl} controls style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
        ) : (
          <iframe src={fileUrl} style={{ width: '80vw', height: '60vh', border: 'none' }} title="Preview" />
        )}
      </div>
      <button onClick={onClose} style={{ position: 'fixed', top: 18, right: 18, zIndex: 210, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }} aria-label="Close preview">✕</button>
    </div>
  );
}
