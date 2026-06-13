import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [history, setHistory] = useState([]);

  // Track viewport width for responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function loadData() {
    try {
      const [statsRes, liveRes, historyRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/sessions/live'),
        api.get('/admin/sessions?status=ended&limit=50'),
      ]);
      setStats(statsRes.data);
      setLiveSessions(liveRes.data.sessions);
      setHistory(historyRes.data.sessions);
    } catch (err) {
      if (err.response?.status === 403) navigate('/dashboard');
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function forceEnd(sessionId) {
    if (!window.confirm('Force end this session?')) return;
    try {
      await api.delete(`/admin/sessions/${sessionId}/force-end`);
      loadData();
    } catch (err) {
      console.error('Failed to force end session:', err);
    }
  }

  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  const statItems = stats ? [
    { label: 'Active sessions', value: stats.activeSessions },
    { label: 'Sessions today', value: stats.todaySessions },
    { label: 'Avg duration today', value: formatDuration(stats.avgDurationSeconds) },
    { label: 'Avg CSAT today', value: stats.avgCsat ? `${stats.avgCsat} / 5` : '—' },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)',
        padding: isMobile ? '0 var(--space-4)' : '0 var(--space-8)', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600 }}>Admin — Support Console</span>
        <button onClick={() => navigate('/dashboard')} style={{
          fontSize: '13px', color: 'var(--color-text-secondary)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          Agent view
        </button>
      </header>

      <main style={{ padding: isMobile ? 'var(--space-4)' : 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {statItems.map(item => (
            <div key={item.label} style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Live sessions */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live sessions ({liveSessions.length})
          </h2>
          <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {liveSessions.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No active sessions
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: isMobile ? '600px' : 'auto', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {['Customer', 'Agent', 'Duration', 'Started', ''].map(h => (
                        <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveSessions.map(session => (
                      <tr key={session.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={tdStyle}>{session.customer_name}</td>
                        <td style={tdStyle}>{session.agent_name}</td>
                        <td style={tdStyle}>{formatDuration(session.duration_seconds)}</td>
                        <td style={tdStyle}>{new Date(session.started_at).toLocaleTimeString()}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => forceEnd(session.id)}
                            style={{
                              padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
                              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                              border: '1px solid var(--color-danger)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            Force end
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Session history
          </h2>
          <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: isMobile ? '600px' : 'auto', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Customer', 'Agent', 'Duration', 'CSAT', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(session => (
                    <tr key={session.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{session.customer_name}</td>
                      <td style={tdStyle}>{session.agent_name}</td>
                      <td style={tdStyle}>{formatDuration(session.duration_seconds)}</td>
                      <td style={tdStyle}>{session.predicted_csat ? `${session.predicted_csat}/5` : '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
                          background: session.resolution_status === 'resolved' ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
                          color: session.resolution_status === 'resolved' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                        }}>
                          {session.resolution_status || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>{new Date(session.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const tdStyle = { padding: 'var(--space-3) var(--space-4)', fontSize: '13px' };
