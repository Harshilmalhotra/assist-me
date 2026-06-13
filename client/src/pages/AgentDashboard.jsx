import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const agent = JSON.parse(localStorage.getItem('agent_user') || '{}');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create session form state
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerTelegram: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreated, setLastCreated] = useState(null);

  async function loadSessions() {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    // Refresh every 30 seconds
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreateSession(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', form);
      setLastCreated(data);
      setForm({ customerName: '', customerEmail: '', customerTelegram: '' });
      loadSessions();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  const statusColors = {
    waiting: 'var(--color-warning)',
    active: 'var(--color-success)',
    ended: 'var(--color-text-muted)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <header style={{
        height: '52px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-6)',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600 }}>Support Console</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            {agent.name}
          </span>
          {agent.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              style={ghostButtonStyle}
            >
              Admin
            </button>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/login');
            }}
            style={ghostButtonStyle}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Session list */}
        <aside style={{
          width: '320px',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sessions
            </h2>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Loading…
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No sessions yet. Create one using the form.
              </div>
            )}
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontWeight: 500 }}>{session.customer_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: statusColors[session.status],
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {session.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {new Date(session.created_at).toLocaleString()} · {formatDuration(session.duration_seconds)}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Create session form */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
            Start a new session
          </h1>

          <form onSubmit={handleCreateSession} style={{ maxWidth: '480px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Customer name *</label>
              <input
                style={inputStyle}
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                placeholder="Rahul Sharma"
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Customer email</label>
              <input
                type="email"
                style={inputStyle}
                value={form.customerEmail}
                onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                placeholder="customer@example.com"
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', display: 'block' }}>
                An invite link will be sent to this address
              </span>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Customer Telegram username</label>
              <input
                style={inputStyle}
                value={form.customerTelegram}
                onChange={e => setForm(f => ({ ...f, customerTelegram: e.target.value }))}
                placeholder="username"
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', display: 'block' }}>
                Customer must have messaged your bot at least once. Include or omit the @.
              </span>
            </div>

            {createError && (
              <div style={errorBoxStyle}>{createError}</div>
            )}

            <button
              type="submit"
              disabled={creating}
              style={{ ...primaryButtonStyle, marginTop: 'var(--space-2)' }}
            >
              {creating ? 'Creating…' : 'Create session and send invite'}
            </button>
          </form>

          {/* Join link display after creation */}
          {lastCreated && (
            <div style={{
              marginTop: 'var(--space-8)',
              padding: 'var(--space-5)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '480px',
            }}>
              <p style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                Session created — invite sent
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Share this link manually if needed:
              </p>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: 'var(--space-3)',
                background: 'var(--color-surface-raised)',
                borderRadius: 'var(--radius-md)',
                wordBreak: 'break-all',
                color: 'var(--color-text-primary)',
              }}>
                {lastCreated.joinUrl}
              </div>
              <button
                onClick={() => navigate(`/session/${lastCreated.session.id}`)}
                style={{ ...primaryButtonStyle, marginTop: 'var(--space-4)', width: 'auto', padding: '8px 16px' }}
              >
                Join as agent
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const fieldStyle = { marginBottom: 'var(--space-5)' };
const labelStyle = { display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)', fontSize: '13px' };
const inputStyle = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px', background: 'var(--color-background)',
  color: 'var(--color-text-primary)', outline: 'none',
};
const primaryButtonStyle = {
  display: 'block', width: '100%', padding: '9px 16px',
  background: 'var(--color-accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '14px', fontWeight: 500, cursor: 'pointer',
};
const ghostButtonStyle = {
  padding: '5px 10px', background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px', cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
const errorBoxStyle = {
  padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
  background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
  borderRadius: 'var(--radius-md)', fontSize: '13px',
};
