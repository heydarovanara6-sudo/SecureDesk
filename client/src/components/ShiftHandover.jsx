import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ShiftHandover({ onClose }) {
  const [form, setForm] = useState({
    shift_time: 'Morning (06:00-18:00)',
    platform_status: 'Normal',
    issues_flagged: '',
    action_needed: '',
    next_engineer: ''
  });
  const [latest, setLatest] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/handover/latest', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data) setLatest(res.data);
      } catch (err) {
        console.error('Failed to fetch handover');
      }
    };
    fetchLatest();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:5000/api/handover', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error('Failed to submit handover');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Normal': return 'text-green-400 bg-green-900 bg-opacity-30';
      case 'Issue': return 'text-yellow-400 bg-yellow-900 bg-opacity-30';
      case 'Critical': return 'text-red-400 bg-red-900 bg-opacity-30';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center p-4">
      <div className="bg-bp-gray rounded-xl w-full max-w-lg max-h-screen overflow-y-auto">

        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">📋 Shift Handover</h2>
              <p className="text-gray-400 text-sm">ACG Offshore Platform</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Latest Handover */}
        {latest && (
          <div className="p-4 mx-4 mt-4 bg-bp-dark rounded-lg border border-gray-700">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Previous Handover</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">{latest.engineer_name}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(latest.platform_status)}`}>
                {latest.platform_status}
              </span>
            </div>
            <p className="text-gray-400 text-xs">{latest.shift_time}</p>
            {latest.issues_flagged && (
              <p className="text-yellow-400 text-sm mt-2">⚠️ {latest.issues_flagged}</p>
            )}
            {latest.action_needed && (
              <p className="text-blue-400 text-sm mt-1">→ {latest.action_needed}</p>
            )}
          </div>
        )}

        {/* Form */}
        {submitted ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-green-400 font-semibold">Handover submitted successfully</p>
            <p className="text-gray-400 text-sm mt-2">Pinned to #acg-operations</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Shift Time */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Shift</label>
              <select
                value={form.shift_time}
                onChange={(e) => setForm({...form, shift_time: e.target.value})}
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-bp-green"
              >
                <option>Morning (06:00-18:00)</option>
                <option>Evening (18:00-06:00)</option>
                <option>Night (00:00-12:00)</option>
              </select>
            </div>

            {/* Platform Status */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Platform Status</label>
              <div className="flex gap-3">
                {['Normal', 'Issue', 'Critical'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm({...form, platform_status: status})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      form.platform_status === status
                        ? getStatusColor(status) + ' border border-current'
                        : 'bg-bp-dark text-gray-500 border border-gray-700'
                    }`}
                  >
                    {status === 'Normal' ? '🟢' : status === 'Issue' ? '🟡' : '🔴'} {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Issues Flagged</label>
              <textarea
                value={form.issues_flagged}
                onChange={(e) => setForm({...form, issues_flagged: e.target.value})}
                placeholder="Any equipment issues, anomalies or safety concerns..."
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-2 h-20 resize-none focus:outline-none focus:border-bp-green"
              />
            </div>

            {/* Action Needed */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Action Needed Next Shift</label>
              <textarea
                value={form.action_needed}
                onChange={(e) => setForm({...form, action_needed: e.target.value})}
                placeholder="What does the incoming engineer need to do..."
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-2 h-20 resize-none focus:outline-none focus:border-bp-green"
              />
            </div>

            {/* Next Engineer */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Next Shift Engineer</label>
              <input
                type="text"
                value={form.next_engineer}
                onChange={(e) => setForm({...form, next_engineer: e.target.value})}
                placeholder="Name of incoming engineer..."
                className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-bp-green"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-bp-green hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Submit Handover & Pin to Channel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ShiftHandover;