import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../LanguageContext';
import LanguageSelector from './LanguageSelector';
import API_BASE from '../config';

function Login({ onLogin, onGoRegister }) {
  const { t } = useLanguage();

  /* ── step: 'credentials' | 'mfa' ── */
  const [step, setStep]         = useState('credentials');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  /* MFA */
  const [mfaEmail, setMfaEmail] = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const inputRefs = useRef([]);

  /* focus first OTP cell when step changes */
  useEffect(() => {
    if (step === 'mfa') setTimeout(() => inputRefs.current[0]?.focus(), 80);
  }, [step]);

  /* ── Step 1: credentials ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/login`, { email, password });
      if (res.data.mfa_required) {
        setMfaEmail(res.data.email);
        setStep('mfa');
      } else {
        onLogin(res.data.user, res.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: MFA OTP ── */
  const handleOtpChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) return;
    const next = [...otp];
    next[index] = val.slice(-1);
    setOtp(next);
    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKey = (index, e) => {
    if (e.key === 'Backspace') {
      const next = [...otp];
      if (next[index]) {
        next[index] = '';
        setOtp(next);
      } else if (index > 0) {
        next[index - 1] = '';
        setOtp(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  /* handle paste of full 6-digit code */
  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const otpValue = otp.join('');

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (otpValue.length !== 6) { setMfaError('Enter the 6-digit code'); return; }
    setMfaError('');
    setMfaLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/mfa/verify`, { email: mfaEmail, otp: otpValue });
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Invalid code');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setMfaLoading(false);
    }
  };

  /* ════════════════════════════════════════════
     MFA STEP
  ════════════════════════════════════════════ */
  if (step === 'mfa') {
    return (
      <div className="login-bg flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">

          <div className="flex justify-end mb-6"><LanguageSelector /></div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bounce-in"
              style={{ background: 'linear-gradient(135deg,#007A3D,#00A650)', boxShadow: '0 8px 32px rgba(0,166,80,.3)' }}>
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-white font-bold tracking-tight fade-up" style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', animationDelay: '.1s' }}>
              Two-Factor Auth
            </h1>
            <p className="text-sm mt-1 fade-up" style={{ color: 'var(--text-secondary)', animationDelay: '.15s' }}>
              Open your authenticator app
            </p>
          </div>

          <div className="login-card scale-in">
            <p className="text-gray-400 text-sm text-center mb-6">
              Enter the <strong className="text-white">6-digit code</strong> from your authenticator app for<br />
              <span className="text-bp-green text-xs">{mfaEmail}</span>
            </p>

            {mfaError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm fade-up"
                style={{ background: 'rgba(255,68,68,.08)', border: '1px solid rgba(255,68,68,.25)', color: '#FF6B6B' }}>
                {mfaError}
              </div>
            )}

            <form onSubmit={handleMfaVerify}>
              {/* 6 individual digit boxes */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    className="w-11 h-13 text-center text-xl font-bold rounded-lg border-2 transition outline-none"
                    style={{
                      background: 'var(--bg-dark)',
                      borderColor: digit ? 'var(--bp-green)' : 'rgba(255,255,255,.15)',
                      color: 'white',
                      height: '3.2rem'
                    }}
                  />
                ))}
              </div>

              <button type="submit" disabled={mfaLoading || otpValue.length !== 6}
                className="btn-primary w-full" style={{ padding: '11px', fontSize: '0.9rem' }}>
                {mfaLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⊙</span> Verifying…
                  </span>
                ) : 'Verify & Sign In'}
              </button>
            </form>

            <button
              onClick={() => { setStep('credentials'); setOtp(['','','','','','']); setMfaError(''); }}
              className="w-full mt-3 text-center text-sm text-gray-500 hover:text-gray-300 transition"
            >
              ← Back to login
            </button>

            <div className="flex justify-center mt-5">
              <span className="enc-badge">🔒 AES-256 End-to-End Encrypted</span>
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            Restricted to @bp.com accounts only
          </p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     CREDENTIALS STEP
  ════════════════════════════════════════════ */
  return (
    <div className="login-bg flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-end mb-6"><LanguageSelector /></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bounce-in"
            style={{ background: 'linear-gradient(135deg,#007A3D,#00A650)', boxShadow: '0 8px 32px rgba(0,166,80,.3)' }}>
            <img src="/bplogo.png" alt="BP" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-white font-bold tracking-tight fade-up"
            style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', animationDelay: '.1s' }}>
            SecureDesk
          </h1>
          <p className="text-sm mt-1 fade-up" style={{ color: 'var(--text-secondary)', animationDelay: '.15s' }}>
            BP Azerbaijan · Encrypted Messenger
          </p>
        </div>

        <div className="login-card scale-in">
          <h2 className="font-semibold mb-6 text-white fade-up" style={{ fontSize: '1rem', animationDelay: '.05s' }}>
            {t.signIn}
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm fade-up"
              style={{ background: 'rgba(255,68,68,.08)', border: '1px solid rgba(255,68,68,.25)', color: '#FF6B6B' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                EMAIL ADDRESS
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@bp.com" required className="chat-input" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                PASSWORD
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="chat-input pr-10" />
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
                  <span className="animate-spin">⊙</span> Signing in…
                </span>
              ) : t.signInButton}
            </button>
          </form>

          <div className="flex justify-center mt-5">
            <span className="enc-badge">🔒 AES-256 End-to-End Encrypted</span>
          </div>

          <div className="mt-5 pt-5 text-center text-sm"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {t.newEmployee}{' '}
            <button onClick={onGoRegister} className="font-semibold transition hover:opacity-80"
              style={{ color: 'var(--bp-green)' }}>
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