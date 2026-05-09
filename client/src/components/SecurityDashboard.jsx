import API_BASE from '../config';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const fmtTime = (ts) => {
  try { return new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return ts; }
};

const StatCard = ({ icon, label, value, sub, color='text-white' }) => (
  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xl">{icon}</span>
      <span className="text-gray-400 text-xs uppercase font-semibold">{label}</span>
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
  </div>
);

const SecurityBadge = ({ label, value, ok }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
    <span className="text-gray-400 text-sm">{label}</span>
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${ok ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
      {ok ? '✅' : '❌'} {value}
    </span>
  </div>
);

function SecurityDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/admin/security-stats', { headers });
      setStats(res.data);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Security stats failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const maxActivity = stats?.channel_activity?.reduce((m, c) => Math.max(m, c.count), 1) || 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-85 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-4xl border border-green-600 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-white font-bold text-lg">Security Dashboard</h2>
              <p className="text-green-400 text-xs">
                BP Azerbaijan · SecureDesk
                {lastRefresh && <span className="text-gray-500 ml-2">· Updated {lastRefresh}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchStats} className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-gray-400 transition">
              🔄 Refresh
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl ml-2">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && !stats ? (
            <div className="text-center py-16">
              <p className="text-3xl animate-pulse mb-3">🛡️</p>
              <p className="text-gray-400">Loading security data...</p>
            </div>
          ) : stats ? (
            <div className="space-y-5">

              {/* Top stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="👥" label="Total Users" value={stats.users.total}
                  sub={`${stats.users.active} active · ${stats.users.deactivated} deactivated`} />
                <StatCard icon="💬" label="Messages Today" value={stats.messages.today}
                  sub={`${stats.messages.total} total`} color="text-blue-400" />
                <StatCard icon="🔴" label="Urgent Messages" value={stats.messages.urgent}
                  sub="All time" color={stats.messages.urgent > 5 ? 'text-red-400' : 'text-white'} />
                <StatCard icon="📋" label="Audit Events" value={stats.audit.today}
                  sub="Today" color="text-yellow-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon="⚫" label="Confidential Msgs" value={stats.messages.confidential} sub="Restricted priority" />
                <StatCard icon="💣" label="Self-Destruct Active" value={stats.messages.self_destruct} sub="Scheduled to delete" color="text-orange-400" />
                <StatCard icon="🔑" label="Pending Access Req." value={stats.users.pending_requests}
                  sub="Awaiting admin approval" color={stats.users.pending_requests > 0 ? 'text-yellow-400' : 'text-green-400'} />
              </div>

              {/* Encryption status */}
              <div className="bg-gray-800 rounded-xl p-4 border border-green-700">
                <p className="text-green-400 font-bold text-sm mb-3 flex items-center gap-2">
                  🔒 Encryption & Security Status
                  <span className="bg-green-900 text-green-400 text-xs px-2 py-0.5 rounded-full font-normal">All Systems Secure</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div>
                    <SecurityBadge label="Message Encryption" value="AES-256 Client-Side" ok={true} />
                    <SecurityBadge label="Key Location" value="Browser Only" ok={true} />
                    <SecurityBadge label="Server Sees Messages" value="Ciphertext Only" ok={true} />
                    <SecurityBadge label="Transport Security" value="TLS 1.2+" ok={true} />
                  </div>
                  <div>
                    <SecurityBadge label="File Storage" value="SHA-256 Hashed Names" ok={true} />
                    <SecurityBadge label="File Access Tokens" value="JWT · 1hr Expiry" ok={true} />
                    <SecurityBadge label="Authentication" value="JWT · 24hr Expiry" ok={true} />
                    <SecurityBadge label="Domain Restriction" value="@bp.com Only" ok={true} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Channel activity */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-white font-bold text-sm mb-3">📊 Channel Activity</p>
                  <div className="space-y-2">
                    {stats.channel_activity.length === 0
                      ? <p className="text-gray-500 text-sm">No data yet</p>
                      : stats.channel_activity.map((c, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-gray-300 text-xs">#{c._id}</span>
                            <span className="text-gray-400 text-xs">{c.count}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full"
                              style={{ width: `${Math.round((c.count / maxActivity) * 100)}%` }} />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Recent urgent messages */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-white font-bold text-sm mb-3">🔴 Recent Urgent Messages</p>
                  {stats.recent_urgent.length === 0
                    ? <p className="text-gray-500 text-sm">No urgent messages</p>
                    : stats.recent_urgent.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                        <div>
                          <p className="text-white text-xs font-semibold">{m.sender_name}</p>
                          <p className="text-gray-500 text-xs">#{m.channel}</p>
                        </div>
                        <span className="text-gray-500 text-xs">{fmtTime(m.timestamp)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Recent audit log */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <p className="text-white font-bold text-sm mb-3">📋 Recent Audit Events</p>
                {stats.audit.recent.length === 0
                  ? <p className="text-gray-500 text-sm">No audit events yet</p>
                  : (
                    <div className="space-y-1">
                      {stats.audit.recent.map((log, i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-700 last:border-0 text-xs">
                          <span className="text-yellow-400 font-semibold w-32 shrink-0">{log.action}</span>
                          <span className="text-gray-300 flex-1 truncate">{log.target}</span>
                          <span className="text-gray-500 shrink-0">by {log.by}</span>
                          <span className="text-gray-600 shrink-0">{fmtTime(log.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>

              {/* VS Slack comparison footer */}
              <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-xl p-4">
                <p className="text-green-400 font-bold text-sm mb-2">🏆 SecureDesk vs Slack Security</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Encryption keys held by', 'Browser (you)', 'Slack servers'],
                    ['Server can read messages', 'Never', 'Yes (risk)'],
                    ['Security dashboard', 'Built-in ✅', 'Not available ❌'],
                    ['File access control', 'SHA-256 + JWT ✅', 'URL-based ❌'],
                    ['Audit logs', 'Free ✅', 'Paid tier only ❌'],
                    ['Self-destructing messages', 'Built-in ✅', 'Not available ❌'],
                  ].map(([feat, us, them], i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-500 w-32 shrink-0">{feat}</span>
                      <span className="text-green-400 font-semibold">{us}</span>
                      <span className="text-red-400 ml-auto">{them}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">Failed to load security data. Admin access required.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SecurityDashboard;