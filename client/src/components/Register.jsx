import React, { useState } from 'react';
import axios from 'axios';
import API_BASE from '../config';

const DEPARTMENTS = [
  'ACG Operations', 'Shah Deniz', 'HR', 'Legal',
  'Finance', 'Executive', 'IT Security', 'General'
];

const inputCls =
  'w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 ' +
  'focus:outline-none focus:border-bp-green transition placeholder-gray-600';

function Register({ onGoLogin }) {
  // ── Step 1: registration form ──
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', department: '', phone: ''
  });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // ── Step 2: MFA setup ──
  const [step, setStep]               = useState('form'); // 'form' | 'mfa'
  const [mfaMode, setMfaMode]         = useState('totp'); // 'totp' | 'sms'
  const [qrCode, setQrCode]           = useState('');
  const [mfaEmail, setMfaEmail]       = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [otp, setOtp]                 = useState('');
  const [mfaError, setMfaError]       = useState('');
  const [mfaLoading, setMfaLoading]   = useState(false);
  const [smsSent, setSmsSent]         = useState(false);
  const [smsSending, setSmsSending]   = useState(false);
  const [mfaDone, setMfaDone]         = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // password strength
  const strength = (() => {
    const p = form.password;
    if (!p) return null;
    let s = 0;
    if (p.length >= 8)           s++;
    if (/[A-Z]/.test(p))         s++;
    if (/[0-9]/.test(p))         s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength ?? 0];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'][strength ?? 0];

  // ── Submit registration form ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.endsWith('@bp.com'))       { setError('Only @bp.com emails are allowed'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 8)              { setError('Password must be at least 8 characters'); return; }
    if (!form.phone.trim())                    { setError('Phone number is required'); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/register`, {
        name: form.name, email: form.email, password: form.password,
        department: form.department, phone: form.phone
      });
      setQrCode(res.data.qr_code);
      setMfaEmail(res.data.email);
      setPhoneMasked(res.data.phone_masked);
      setSmsAvailable(res.data.sms_available);
      setStep('mfa');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Send SMS code ──
  const handleSendSms = async () => {
    setSmsSending(true);
    setMfaError('');
    try {
      await axios.post(`${API_BASE}/api/mfa/send-sms`, { email: mfaEmail });
      setSmsSent(true);
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to send SMS');
    } finally {
      setSmsSending(false);
    }
  };

  // ── Switch to SMS mode ──
  const switchToSms = async () => {
    setMfaMode('sms');
    setOtp('');
    setMfaError('');
    setSmsSent(false);
    await handleSendSms();
  };

  // ── Switch back to TOTP mode ──
  const switchToTotp = () => {
    setMfaMode('totp');
    setOtp('');
    setMfaError('');
    setSmsSent(false);
  };

  // ── Confirm MFA (TOTP or SMS) ──
  const handleMfaConfirm = async (e) => {
    e.preventDefault();
    setMfaError('');
    if (otp.length !== 6) { setMfaError('Enter the 6-digit code'); return; }
    setMfaLoading(true);
    try {
      const endpoint = mfaMode === 'sms'
        ? `${API_BASE}/api/mfa/confirm-sms`
        : `${API_BASE}/api/mfa/confirm`;
      await axios.post(endpoint, { email: mfaEmail, otp });
      setMfaDone(true);
      setTimeout(() => onGoLogin(), 2500);
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Invalid code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  // ════════════════════════════════════════════
  // STEP 2 — MFA Setup
  // ════════════════════════════════════════════
  if (step === 'mfa') {
    return (
      <div className="min-h-screen bg-bp-dark flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg,#007A3D,#00A650)', boxShadow: '0 8px 32px rgba(0,166,80,.3)' }}>
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-white font-bold text-2xl">Setup Two-Factor Auth</h1>
            <p className="text-gray-400 text-sm mt-1">Choose your preferred verification method</p>
          </div>

          <div className="bg-bp-gray rounded-2xl p-6 shadow-2xl">
            {mfaDone ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-green-400 font-semibold text-lg">MFA Enabled!</p>
                <p className="text-gray-400 text-sm mt-2">Redirecting to sign in…</p>
              </div>
            ) : (
              <>
                {/* ── Method toggle tabs ── */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-5">
                  <button
                    onClick={switchToTotp}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      mfaMode === 'totp'
                        ? 'bg-bp-green text-white'
                        : 'bg-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    📱 Authenticator App
                  </button>
                  {smsAvailable && (
                    <button
                      onClick={switchToSms}
                      disabled={smsSending}
                      className={`flex-1 py-2 text-sm font-medium transition ${
                        mfaMode === 'sms'
                          ? 'bg-bp-green text-white'
                          : 'bg-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      💬 SMS to phone
                    </button>
                  )}
                </div>

                {/* ── TOTP mode ── */}
                {mfaMode === 'totp' && (
                  <>
                    <p className="text-gray-300 text-sm mb-3 text-center">
                      Scan with <strong className="text-white">Google Authenticator</strong> or <strong className="text-white">Authy</strong>
                    </p>
                    <div className="flex justify-center mb-3">
                      <div className="bg-white p-3 rounded-xl">
                        <img src={qrCode} alt="MFA QR Code" className="w-44 h-44" />
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs text-center mb-4">
                      After scanning, enter the 6-digit code from your app.
                    </p>
                  </>
                )}

                {/* ── SMS mode ── */}
                {mfaMode === 'sms' && (
                  <div className="mb-4">
                    {smsSent ? (
                      <div className="rounded-lg px-4 py-3 text-sm text-center mb-3"
                        style={{ background: 'rgba(0,166,80,.1)', border: '1px solid rgba(0,166,80,.3)', color: '#4ade80' }}>
                        ✓ Code sent to <strong>{phoneMasked}</strong>
                      </div>
                    ) : smsSending ? (
                      <p className="text-gray-400 text-sm text-center mb-3">Sending SMS…</p>
                    ) : null}
                    <p className="text-gray-400 text-xs text-center">
                      Code expires in 10 minutes.{' '}
                      <button
                        onClick={handleSendSms}
                        disabled={smsSending}
                        className="text-bp-green hover:underline disabled:opacity-50"
                      >
                        Resend
                      </button>
                    </p>
                  </div>
                )}

                {mfaError && (
                  <div className="mb-3 px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(255,68,68,.08)', border: '1px solid rgba(255,68,68,.25)', color: '#FF6B6B' }}>
                    {mfaError}
                  </div>
                )}

                <form onSubmit={handleMfaConfirm}>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 tracking-wider">
                    VERIFICATION CODE
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="000000"
                    maxLength={6}
                    className={`${inputCls} text-center text-2xl tracking-[0.5em] font-mono`}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={mfaLoading || otp.length !== 6}
                    className="w-full mt-4 bg-bp-green hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
                  >
                    {mfaLoading ? 'Verifying…' : 'Confirm & Enable MFA'}
                  </button>
                </form>

                {!smsAvailable && (
                  <p className="text-gray-600 text-xs text-center mt-3">
                    No second device? Use <strong className="text-gray-500">Authy</strong> desktop or <strong className="text-gray-500">1Password</strong> — they work on the same computer.
                  </p>
                )}
              </>
            )}
          </div>

          <p className="text-center text-gray-600 text-xs mt-5">
            © 2025 BP Azerbaijan. Authorized personnel only.
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STEP 1 — Registration Form
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-bp-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/bplogo.png" alt="BP Logo" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-white text-3xl font-bold">SecureDesk</h1>
          <p className="text-gray-400 mt-1 text-sm">BP Azerbaijan Internal Platform</p>
        </div>

        <div className="bg-bp-gray rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Create Account</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'rgba(255,68,68,.08)', border: '1px solid rgba(255,68,68,.25)', color: '#FF6B6B' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">FULL NAME</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                placeholder="Ali Aliyev" required className={inputCls} />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">BP EMAIL ADDRESS</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="yourname@bp.com" required className={inputCls} />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">PHONE NUMBER</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">📞</span>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="+994 50 000 00 00" required
                  className={`${inputCls} pl-9`} />
              </div>
              <p className="text-gray-600 text-xs mt-1">Used for SMS verification if you choose it</p>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">DEPARTMENT</label>
              <select name="department" value={form.department} onChange={handleChange} required className={inputCls}>
                <option value="">Select department…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">PASSWORD</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} name="password"
                  value={form.password} onChange={handleChange}
                  placeholder="Min. 8 characters" required className={`${inputCls} pr-16`} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: i <= (strength ?? 0) ? strengthColor : '#374151' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block tracking-wider">CONFIRM PASSWORD</label>
              <div className="relative">
                <input type={showConf ? 'text' : 'password'} name="confirmPassword"
                  value={form.confirmPassword} onChange={handleChange}
                  placeholder="••••••••" required className={`${inputCls} pr-16`} />
                <button type="button" onClick={() => setShowConf(!showConf)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white">
                  {showConf ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-bp-green hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition mt-2">
              {loading ? 'Creating account…' : 'Create Account & Setup MFA →'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-gray-500 text-xs">
            <span>🔒</span><span>AES-256 Encrypted · Two-Factor Auth</span>
          </div>

          <p className="text-center text-gray-400 text-sm mt-4">
            Already have an account?{' '}
            <button onClick={onGoLogin} className="text-bp-green hover:underline font-medium">Sign in</button>
          </p>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">© 2025 BP Azerbaijan. Authorized personnel only.</p>
      </div>
    </div>
  );
}

export default Register;