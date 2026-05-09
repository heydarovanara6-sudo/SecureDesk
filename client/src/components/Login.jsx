import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../LanguageContext';
import LanguageSelector from './LanguageSelector';
import API_BASE from '../config';

function Login({ onLogin, onGoRegister }) {
  const { t } = useLanguage();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/login`, { email, password });
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm">

        {/* Language selector */}
        <div className="flex justify-end mb-6">
          <LanguageSelector />
        </div>

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bounce-in"
            style={{ background: 'linear-gradient(135deg, #007A3D, #00A650)', boxShadow: '0 8px 32px rgba(0,166,80,0.3)' }}>
            <img src="/bplogo.png" alt="BP" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-white font-bold tracking-tight fade-up" style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', animationDelay: "0.1s" }}>
            SecureDesk
          </h1>
          <p className="text-sm mt-1 fade-up" style={{ color: 'var(--text-secondary)', animationDelay: "0.15s" }}>BP Azerbaijan · Encrypted Messenger</p>
        </div>

        {/* Card */}
        <div className="login-card scale-in">
          <h2 className="font-semibold mb-6 text-white fade-up" style={{ fontSize: '1rem', animationDelay: "0.05s" }}>{t.signIn}</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm fade-up"
              style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@bp.com"
                required
                className="chat-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="chat-input pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2"
              style={{ padding: '11px', fontSize: '0.9rem' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⊙</span> Signing in...
                </span>
              ) : t.signInButton}
            </button>
          </form>

          {/* Security badge */}
          <div className="flex justify-center mt-5">
            <span className="enc-badge">🔒 AES-256 End-to-End Encrypted</span>
          </div>

          <div className="mt-5 pt-5 text-center text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {t.newEmployee}{' '}
            <button onClick={onGoRegister} className="font-semibold transition hover:opacity-80" style={{ color: 'var(--bp-green)' }}>
              {t.createAccount}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Restricted to @bp.com accounts only
        </p>
      </div>
    </div>
  );
}

export default Login;