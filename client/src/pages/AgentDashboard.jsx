import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, LogOut, Shield, Calendar, Clock, ArrowRight, Download, MessageSquare, Video, Info, X, ExternalLink } from 'lucide-react';
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

  // Session Details state
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);

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
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadSessionDetails(id) {
    setSelectedSessionId(id);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const [sessionRes, recsRes, chatRes] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get(`/recordings/${id}`),
        api.get(`/chat/${id}`)
      ]);
      setDetails(sessionRes.data);
      setRecordings(recsRes.data.recordings || []);
      setChatMessages(chatRes.data.messages || []);
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', form);
      setLastCreated(data);
      setForm({ customerName: '', customerEmail: '', customerTelegram: '', customerPhone: '' });
      loadSessions();
      // Optionally open details for new session:
      // loadSessionDetails(data.session.id);
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
    waiting: '#eab308',
    active: '#22c55e',
    ended: '#94a3b8',
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
          <button
            onClick={() => setSelectedSessionId(null)}
            className="btn-interactive"
            style={{
              padding: isMobile ? '6px 10px' : '8px 16px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
            title="New Session"
          >
            <Plus size={14} /> {!isMobile && 'New Session'}
          </button>

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Support Sessions
            </h2>
            {selectedSessionId && (
              <button 
                onClick={() => setSelectedSessionId(null)}
                className="btn-interactive"
                style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)', 
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Plus size={12} /> New
              </button>
            )}
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
                onClick={() => loadSessionDetails(session.id)}
                className="btn-interactive animate-fade-in"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  border: selectedSessionId === session.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                  background: selectedSessionId === session.id ? 'var(--color-surface-raised)' : 'var(--color-background)',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.015)',
                  transition: 'all 0.2s ease',
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
          {selectedSessionId ? (
            <SessionDetailsView 
              loading={detailsLoading}
              details={details}
              recordings={recordings}
              chatMessages={chatMessages}
              onClose={() => setSelectedSessionId(null)}
              formatDuration={formatDuration}
              statusColors={statusColors}
              statusBgs={statusBgs}
              isMobile={isMobile}
            />
          ) : (
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Client Invite URL:
                      </p>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11.5px', padding: '10px 12px',
                        background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', wordBreak: 'break-all', color: 'var(--color-text-primary)',
                      }}>
                        {lastCreated.joinUrl}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Agent URL:
                      </p>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11.5px', padding: '10px 12px',
                        background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', wordBreak: 'break-all', color: 'var(--color-text-primary)',
                      }}>
                        {`${window.location.origin}/session/${lastCreated.session.id}`}
                      </div>
                    </div>
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
          )}
        </main>
      </div>
    </div>
  );
}

function SessionDetailsView({ loading, details, recordings, chatMessages, onClose, formatDuration, statusColors, statusBgs, isMobile }) {
  if (loading || !details) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading session details...</div>
      </div>
    );
  }

  const { session, intelligence, events } = details;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {session.customer_name}
            </h1>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '12px',
              background: statusBgs[session.status] || '#f1f5f9'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColors[session.status] || '#ccc' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: statusColors[session.status] || '#666', textTransform: 'capitalize' }}>
                {session.status}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {new Date(session.created_at).toLocaleString()}</span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {formatDuration(session.duration_seconds)} duration</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {session.status !== 'ended' && (
            <button
              onClick={() => window.open(`/session/${session.id}`, '_blank')}
              className="btn-interactive"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-lg)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Join Call <ExternalLink size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-interactive"
            style={{
              padding: '8px', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Info Card */}
        <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={16} /> Customer Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Email</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{session.customer_email || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Phone</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{session.customer_phone || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Telegram</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{session.customer_telegram || '—'}</span>
            </div>
          </div>
        </div>

        {/* Intelligence Card */}
        {intelligence && intelligence.summary && (
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(168,85,247,0.05) 100%)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#6366f1', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✨ AI Session Summary
            </h3>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
              {intelligence.summary}
            </p>
          </div>
        )}
      </div>

      {/* Recordings */}
      {recordings && recordings.length > 0 && (
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Video size={16} /> Session Recordings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recordings.map((rec) => (
              <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Video size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Recording Video</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(rec.started_at).toLocaleString()}</div>
                  </div>
                </div>
                {rec.status === 'ready' ? (
                  <a href={rec.download_url} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-interactive" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                      <Download size={14} /> Download
                    </button>
                  </a>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Processing...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat History */}
      {chatMessages && chatMessages.length > 0 && (
        <div style={{ flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={16} /> Chat History
          </h3>
          <div style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, i) => {
              const isAgent = msg.sender_role === 'agent' || msg.sender_role === 'admin';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px', marginLeft: '4px', marginRight: '4px' }}>
                    {msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    padding: '8px 12px', fontSize: '13px', lineHeight: 1.4,
                    background: isAgent ? 'var(--color-accent)' : 'var(--color-background)',
                    color: isAgent ? '#fff' : 'var(--color-text-primary)',
                    borderRadius: '12px', border: isAgent ? 'none' : '1px solid var(--color-border)',
                    maxWidth: '80%'
                  }}>
                    {msg.message_type === 'file' ? (
                      <a href={msg.file_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={14} /> {msg.file_name}
                      </a>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
