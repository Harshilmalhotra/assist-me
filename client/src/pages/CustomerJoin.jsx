import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    // Store invite token and customer name for the call room
    sessionStorage.setItem('invite_token', token);
    sessionStorage.setItem('customer_name', name.trim());
    navigate(`/session/${sessionInfo.sessionId}?token=${token}&name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-surface)',
      display: 'flex', alignItems: 'center', justifycontent: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: 'var(--space-8)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
      }}>
        {state === 'validating' && (
          <p style={{ color: 'var(--color-text-secondary)' }}>Checking your invite…</p>
        )}

        {state === 'error' && (
          <>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Unable to join
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{error}</p>
          </>
        )}

        {state === 'ready' && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
              Support Call
            </p>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Join your support session
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', fontSize: '14px' }}>
              {sessionInfo.agentName} is waiting for you. Your browser will ask for camera and microphone access.
            </p>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)', fontSize: '13px' }}>
                Your name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none',
                }}
                placeholder="Enter your name"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!name.trim() || joining}
              style={{
                width: '100%', padding: '10px 16px',
                background: name.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                color: name.trim() ? '#fff' : 'var(--color-text-muted)',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '14px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default',
              }}
            >
              {joining ? 'Starting…' : 'Join call'}
            </button>

            <p style={{ marginTop: 'var(--space-4)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              No account required. No download needed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
