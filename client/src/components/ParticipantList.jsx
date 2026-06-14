import React from 'react';
import { User, MicOff, Pin } from 'lucide-react';

export default function ParticipantList({ participants = [], pinnedId, onPin, onRequestMute, localSocketId }) {
  return (
    <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 70, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '8px 10px', borderRadius: 10, minWidth: 180 }} aria-label="Participant list">
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Participants</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {participants.map(p => (
          <div key={p.socketId || 'local'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} />
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{p.role}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onRequestMute?.(p)} title="Request mute" aria-label={`Request ${p.name} to mute`} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <MicOff size={16} />
              </button>
              <button onClick={() => onPin?.(p)} title="Pin participant" aria-pressed={p.socketId === pinnedId} style={{ background: p.socketId === pinnedId ? 'rgba(255,255,255,0.12)' : 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: 6 }}>
                <Pin size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
