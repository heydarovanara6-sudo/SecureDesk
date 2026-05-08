import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../LanguageContext';
import LanguageSelector from './LanguageSelector';

function Login({ onLogin, onGoRegister }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/login', {
        email,
        password
      });
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bp-dark flex items-center justify-center">
      <div className="w-full max-w-md">

        {/* Language Selector */}
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>

        {/* BP Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/bplogo.png"
              alt="BP Logo"
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-white text-3xl font-bold">{t.appName}</h1>
          <p className="text-gray-400 mt-2">{t.appSubtitle}</p>
        </div>

        {/* Login Card */}
        <div className="bg-bp-gray rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">{t.signIn}</h2>

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">
                {t.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition"
              />
            </div>

            <div className="mb-6">
              <label className="text-gray-400 text-sm mb-2 block">
                {t.passwordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-bp-green hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition duration-200"
            >
              {loading ? t.signingIn : t.signInButton}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm">
            <span>🔒</span>
            <span>{t.secureConnection}</span>
          </div>

          <p className="text-center text-gray-400 text-sm mt-4">
            {t.newEmployee}{' '}
            <button
              onClick={onGoRegister}
              className="text-bp-green hover:underline"
            >
              {t.createAccount}
            </button>
          </p>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          {t.footer}
        </p>
      </div>
    </div>
  );
}

export default Login;