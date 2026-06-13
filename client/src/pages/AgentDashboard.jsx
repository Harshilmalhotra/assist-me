import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, LogOut, Shield, Calendar, Clock, ArrowRight } from 'lucide-react';
import api from '../api';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const agent = JSON.parse(localStorage.getItem('agent_user') || '{}');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Track viewport width for responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create session form state
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerTelegram: '',
    customerPhone: '',
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
      setForm({ customerName: '', customerEmail: '', customerTelegram: '', customerPhone: '' });
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
    waiting: '#eab308', // yellow
    active: '#22c55e',  // green
    ended: '#94a3b8',   // slate
  };

  const statusBgs = {
    waiting: '#fef9c3',
    active: '#dcfce7',
    ended: '#f1f5f9',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Top Header */}
      <header style={{
        height: '56px',
        background: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 var(--space-3)' : '0 var(--space-6)',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--color-accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff',
            fontWeight: 'bold', fontSize: '16px'
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: '15px', tracking: '-0.01em' }}>{!isMobile && 'Support Console'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 'var(--space-2)' : 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-raised)', padding: isMobile ? '6px' : '6px 12px', borderRadius: '20px' }}>
            <User size={14} style={{ color: 'var(--color-text-secondary)' }} />
            {!isMobile && (
              <span style={{ color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 500 }}>
                {agent.name}
              </span>
            )}
          </div>

          {agent.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="btn-interactive"
              style={{
                padding: isMobile ? '6px 8px' : '6px 14px', background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '20px', fontSize: '12.5px', cursor: 'pointer',
                color: 'var(--color-text-secondary)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
              title="Admin Panel"
            >
              <Shield size={14} /> {!isMobile && 'Admin'}
            </button>
          )}

          <button
            onClick={() => {
              localStorage.clear();
              navigate('/login');
            }}
            className="btn-interactive"
            style={{
              padding: isMobile ? '6px 8px' : '6px 14px', background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '20px', fontSize: '12.5px', cursor: 'pointer',
              color: 'var(--color-danger)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            title="Sign Out"
          >
            <LogOut size={14} /> {!isMobile && 'Sign out'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
        
        {/* Left Sidebar: Session List */}
        <aside style={{
          width: isMobile ? '100%' : '340px',
          height: isMobile ? '240px' : 'auto',
          background: 'var(--color-surface)',
          borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
          borderBottom: isMobile ? '1px solid var(--color-border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Support Sessions
            </h2>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {loading && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center' }}>
                <div style={{
                  width: '20px', height: '20px', border: '2px solid rgba(0,0,0,0.1)',
                  borderTopColor: '#000', borderRadius: '50%', animation: 'pulse 1s linear infinite',
                  margin: '0 auto 8px'
                }} />
                Loading sessions…
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13.5px', textAlign: 'center', lineHeight: 1.4 }}>
                No support sessions found.<br />Create one using the form on the right.
              </div>
            )}
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => window.open(`/session/${session.id}`, '_blank')}
                className="btn-interactive animate-fade-in"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid transparent',
                  background: 'var(--color-background)',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.015)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-surface)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.background = 'var(--color-background)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '13.5px' }}>
                    {session.customer_name}
                  </span>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '2px 8px', borderRadius: '12px',
                    background: statusBgs[session.status] || '#f1f5f9'
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: statusColors[session.status] || '#ccc',
                    }} />
                    <span style={{ 
                      fontSize: '11px', fontWeight: 600, 
                      color: statusColors[session.status] || '#666',
                      textTransform: 'capitalize'
                    }}>
                      {session.status}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={11} /> {new Date(session.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> {formatDuration(session.duration_seconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Dashboard Area */}
        <main 
          className="animate-fade-in"
          style={{ flex: 1, overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? 'var(--space-4)' : 'var(--space-8) var(--space-10)' }}
        >
          <div style={{ maxWidth: '640px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Start Support Session
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: 'var(--space-8)' }}>
              Create a support ticket session and automatically dispatch call invitations via Telegram, email, or SMS.
            </p>

            <div style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6) var(--space-8)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
            }}>
              <form onSubmit={handleCreateSession}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Customer Name *</label>
                    <input
                      style={inputStyle}
                      value={form.customerName}
                      onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                      className="input-focus-glow"
                      placeholder="Rahul Sharma"
                      required
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label style={labelStyle}>Customer Email</label>
                    <input
                      type="email"
                      style={inputStyle}
                      value={form.customerEmail}
                      onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                      className="input-focus-glow"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Telegram Username</label>
                    <input
                      style={inputStyle}
                      value={form.customerTelegram}
                      className="input-focus-glow"
                      onChange={e => setForm(f => ({ ...f, customerTelegram: e.target.value }))}
                      placeholder="username"
                    />
                  </div>

                  <div style={fieldStyle}>
                    <label style={labelStyle}>Phone Number (SMS)</label>
                    <input
                      style={inputStyle}
                      value={form.customerPhone}
                      className="input-focus-glow"
                      onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      placeholder="+916230931075"
                    />
                  </div>
                </div>

                {createError && (
                  <div style={errorBoxStyle}>{createError}</div>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className="btn-interactive"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', padding: '11px 16px',
                    background: 'var(--color-accent)', color: 'var(--color-accent-text)',
                    border: 'none', borderRadius: 'var(--radius-lg)',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Plus size={16} /> {creating ? 'Creating session…' : 'Create Session & Dispatch Invites'}
                </button>
              </form>
            </div>

            {/* Invite Details display after creation */}
            {lastCreated && (
              <div 
                className="animate-slide-up"
                style={{
                  marginTop: 'var(--space-6)',
                  padding: 'var(--space-6)',
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
                  Session Created & Invites Dispatched Successfully!
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  You can copy the session invite link below to share it manually if required:
                </p>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11.5px',
                  padding: '12px 14px',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  wordBreak: 'break-all',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-4)'
                }}>
                  {lastCreated.joinUrl}
                </div>
                
                <button
                  onClick={() => window.open(`/session/${lastCreated.session.id}`, '_blank')}
                  className="btn-interactive"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', background: '#22c55e', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-lg)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Join Call as Agent <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const fieldStyle = { display: 'flex', flexDirection: 'column' };
const labelStyle = { display: 'block', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', fontSize: '12.5px' };
const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  fontSize: '13.5px', background: 'var(--color-background)',
  color: 'var(--color-text-primary)', outline: 'none',
};
const errorBoxStyle = {
  padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
  background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
  borderRadius: 'var(--radius-md)', fontSize: '13px',
  border: '1px solid rgba(220, 38, 38, 0.15)',
  textAlign: 'center'
};
