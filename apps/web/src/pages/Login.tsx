import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await login(email.trim(), password);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? 'Login failed'); return; }
    nav('/app');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="brand-mark">♥</span> Bond</span>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Log in to your Bond space from any computer.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="input" type="password" placeholder="Your password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error ? <div className="field-error">{error}</div> : null}
          <button className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="auth-alt">New to Bond? <Link to="/signup">Create account</Link></div>
      </div>
    </div>
  );
}
