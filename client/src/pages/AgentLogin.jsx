import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AgentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Track viewport width for responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('agent_token', data.token);
      localStorage.setItem('agent_user', JSON.stringify(data.agent));
      navigate(data.agent.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin(role) {
    const credentials = role === 'admin'
      ? { email: 'admin@example.com', password: 'admin123' }
      : { email: 'agent@example.com', password: 'agent123' };

    setEmail(credentials.email);
    setPassword(credentials.password);
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', credentials);
      localStorage.setItem('agent_token', data.token);
      localStorage.setItem('agent_user', JSON.stringify(data.agent));
      navigate(data.agent.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-raised) 100%)',
      padding: 'var(--space-4)',
    }}>
      <div 
        className="glass-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: isMobile ? 'var(--space-6) var(--space-5)' : 'var(--space-8) var(--space-10)',
          borderRadius: 'var(--radius-xl)',
          color: 'var(--color-text-primary)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
          <div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'block',
              marginBottom: 'var(--space-1)'
            }}>
              Internal Portal
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
              Support Console
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
              Sign in to your agent or admin console
            </p>
          </div>

          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
            <a
              href="https://youtu.be/1uJEPdNha_w"
              target="_blank"
              rel="noopener noreferrer"
              title="Watch walkthrough video"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.05)',
                color: 'var(--color-text-primary)',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid rgba(0,0,0,0.04)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
              </svg>
              Watch tutorial
            </a>
          </div>
        </div>

        <div style={{
          padding: '18px 16px',
          borderRadius: '20px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.18)',
          marginBottom: 'var(--space-6)'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>
            Quick login
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                background: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Login as Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('agent')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                background: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Login as Agent
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="input-focus-glow"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '14px',
                background: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
              placeholder="agent@example.com"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-focus-glow"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '14px',
                background: 'var(--color-background)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(220, 38, 38, 0.15)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-interactive"
            style={{
              width: '100%',
              padding: '11px 16px',
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in to Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
