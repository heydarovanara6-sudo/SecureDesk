import React, { useState } from 'react';
import axios from 'axios';
import API_BASE from '../config';

function Register({ onGoLogin }) {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', department: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const departments = [
    'ACG Operations','Shah Deniz','HR','Legal',
    'Finance','Executive','IT Security','General'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    if (!formData.email.endsWith('@bp.com')) {
      setError('Only @bp.com email addresses are allowed');
      setLoading(false); return;
    }
    try {
      await axios.post(`${API_BASE}/api/register`, formData);
      setSuccess('Account created! You can now sign in.');
      setTimeout(() => onGoLogin(), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bp-dark flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/bplogo.png" alt="BP Logo" className="w-24 h-24 object-contain mx-auto mb-4" />
          <h1 className="text-white text-3xl font-bold">SecureDesk</h1>
          <p className="text-gray-400 mt-2">BP Azerbaijan Internal Platform</p>
        </div>
        <div className="bg-bp-gray rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Create Account</h2>
          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}
          {success && (
            <div className="bg-green-500 bg-opacity-20 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-4">{success}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                placeholder="Ali Aliyev" required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition" />
            </div>
            <div className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">BP Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                placeholder="yourname@bp.com" required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition" />
            </div>
            <div className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange}
                placeholder="••••••••" required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition" />
            </div>
            <div className="mb-6">
              <label className="text-gray-400 text-sm mb-2 block">Department</label>
              <select name="department" value={formData.department} onChange={handleChange} required
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-bp-green transition">
                <option value="">Select department...</option>
                {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-bp-green hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition duration-200">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm">
            <span>🔒</span><span>Connection Secure — AES-256 Encrypted</span>
          </div>
          <p className="text-center text-gray-400 text-sm mt-4">
            Already have an account?{' '}
            <button onClick={onGoLogin} className="text-bp-green hover:underline">Sign in</button>
          </p>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">© 2025 BP Azerbaijan. Authorized personnel only.</p>
      </div>
    </div>
  );
}

export default Register;