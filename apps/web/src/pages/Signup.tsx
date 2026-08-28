import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const r = await signup(email.trim(), password, name.trim());
    setLoading(false);
    if (!r.ok) { setError(r.error ?? 'Sign up failed'); return; }
    nav('/app');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="brand-mark">♥</span> Bond</span>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Join your private space for the people who matter.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label">Display name</label>
            <input className="input" placeholder="What should people call you?" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="input" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Confirm password</label>
            <input className="input" type="password" placeholder="Repeat your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error ? <div className="field-error">{error}</div> : null}
          <button className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-alt">Already have an account? <Link to="/login">Log in</Link></div>
      </div>
    </div>
  );
}
