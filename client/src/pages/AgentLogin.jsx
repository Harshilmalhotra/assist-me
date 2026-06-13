import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AgentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-surface)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        padding: 'var(--space-8)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
          Support Console
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          Sign in to your agent account
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
              placeholder="agent@example.com"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  background: 'var(--color-background)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  transition: 'border-color var(--transition-fast)',
};

const primaryButtonStyle = {
  width: '100%',
  padding: '9px 16px',
  background: 'var(--color-accent)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};
