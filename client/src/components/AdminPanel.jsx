import API_BASE from '../config';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const asArray = (value) => Array.isArray(value) ? value : [];

function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  // Channel permissions state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userChannels, setUserChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [revoking, setRevoking] = useState(null); // channel_name being revoked
  const [toast, setToast] = useState(null);

  const token = localStorage.getItem('token');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, usersRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/requests`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/admin/audit`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRequests(asArray(reqRes.data));
      setUsers(asArray(usersRes.data));
      setAudit(asArray(auditRes.data));
    } catch (err) {
      console.error('Failed to fetch admin data');
      setRequests([]); setUsers([]); setAudit([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequest = async (email, channel, action) => {
    try {
      await axios.post(
        `${API_BASE}/api/admin/requests/${email}/${channel}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(action === 'approve' ? `✅ Access approved for #${channel}` : `❌ Request denied`);
      fetchData();
    } catch (err) {
      showToast('Failed to handle request', 'error');
    }
  };

  const handleToggleUser = async (email) => {
    try {
      await axios.post(
        `${API_BASE}/api/admin/users/${email}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (err) {
      showToast('Failed to toggle user', 'error');
    }
  };

  const openUserChannels = async (user) => {
    setSelectedUser(user);
    setChannelsLoading(true);
    setUserChannels([]);
    try {
      const res = await axios.get(
        `${API_BASE}/api/admin/users/${encodeURIComponent(user.email)}/channels`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserChannels(asArray(res.data));
    } catch (err) {
      showToast('Failed to load user channels', 'error');
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleRevoke = async (userEmail, channelName) => {
    setRevoking(channelName);
    try {
      await axios.post(
        `${API_BASE}/api/admin/users/${encodeURIComponent(userEmail)}/channels/${channelName}/revoke`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserChannels(prev => prev.filter(c => c.channel_name !== channelName));
      showToast(`🔒 Removed access to #${channelName}`);
      fetchData(); // refresh audit
    } catch (err) {
      showToast('Failed to revoke access', 'error');
    } finally {
      setRevoking(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const TABS = [
    { id: 'requests', label: `Access Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` },
    { id: 'permissions', label: 'Channel Permissions' },
    { id: 'users', label: 'Users' },
    { id: 'audit', label: 'Audit Log' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-bp-gray rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Toast */}
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.type === 'error' ? 'bg-red-700 text-white' : 'bg-green-700 text-white'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-xl">⚙️ Admin Panel</h2>
            <p className="text-gray-400 text-sm">BP Azerbaijan — SecureDesk Management</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedUser(null); }}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition ${
                tab === t.id
                  ? 'text-bp-green border-b-2 border-bp-green'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading...</p>
          ) : (
            <>
              {/* ── ACCESS REQUESTS ── */}
              {tab === 'requests' && (
                <div className="space-y-3">
                  {requests.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No access requests</p>
                  ) : requests.map((req, i) => (
                    <div key={i} className="bg-bp-dark rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 bg-bp-green rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getInitial(req.user_name)}
                          </div>
                          <span className="text-white font-medium text-sm">{req.user_name}</span>
                          <span className="text-gray-500 text-xs">{req.department}</span>
                        </div>
                        <p className="text-gray-400 text-xs ml-9">
                          Requesting access to <strong className="text-white">#{req.channel_name}</strong>
                        </p>
                        <p className="text-gray-600 text-xs ml-9">{req.created_at?.slice(0, 10)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleRequest(req.user_email, req.channel_name, 'deny')}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg"
                            >Deny</button>
                            <button
                              onClick={() => handleRequest(req.user_email, req.channel_name, 'approve')}
                              className="px-3 py-1.5 bg-bp-green hover:bg-green-700 text-white text-xs rounded-lg font-bold"
                            >Approve</button>
                          </>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            req.status === 'approved' ? 'bg-green-900 text-green-400'
                            : req.status === 'revoked' ? 'bg-orange-900 text-orange-400'
                            : 'bg-red-900 text-red-400'
                          }`}>
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── CHANNEL PERMISSIONS ── */}
              {tab === 'permissions' && (
                <div className="flex gap-4 h-full" style={{ minHeight: 320 }}>
                  {/* User list */}
                  <div className="w-52 flex-shrink-0 space-y-1 overflow-y-auto pr-1">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-1">Select User</p>
                    {users.map((u, i) => (
                      <button
                        key={i}
                        onClick={() => openUserChannels(u)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition ${
                          selectedUser?.email === u.email
                            ? 'bg-bp-green bg-opacity-20 border border-bp-green border-opacity-40'
                            : 'bg-bp-dark hover:bg-gray-700'
                        }`}
                      >
                        <div className="w-7 h-7 bg-bp-green rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitial(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{u.name}</p>
                          <p className="text-gray-500 text-xs truncate">{u.department}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Channel permissions panel */}
                  <div className="flex-1 bg-bp-dark rounded-xl p-4">
                    {!selectedUser ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <span className="text-3xl mb-3">🔑</span>
                        <p className="text-gray-400 text-sm">Select a user to manage their channel permissions</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-700">
                          <div className="w-9 h-9 bg-bp-green rounded-full flex items-center justify-center text-white font-bold">
                            {getInitial(selectedUser.name)}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{selectedUser.name}</p>
                            <p className="text-gray-400 text-xs">{selectedUser.email} · {selectedUser.department}</p>
                          </div>
                        </div>

                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">
                          Approved Channel Access
                        </p>

                        {channelsLoading ? (
                          <p className="text-gray-500 text-sm text-center py-6">Loading...</p>
                        ) : userChannels.length === 0 ? (
                          <div className="text-center py-8">
                            <span className="text-2xl">🔓</span>
                            <p className="text-gray-500 text-sm mt-2">No extra channel access granted</p>
                            <p className="text-gray-600 text-xs mt-1">This user only has access to public channels</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {userChannels.map((ch, i) => (
                              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                                <div>
                                  <span className="text-white text-sm font-medium">#{ch.channel_name}</span>
                                  {ch.resolved_at && (
                                    <span className="text-gray-500 text-xs ml-2">
                                      granted {ch.resolved_at.slice(0, 10)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRevoke(selectedUser.email, ch.channel_name)}
                                  disabled={revoking === ch.channel_name}
                                  className="px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs rounded-lg flex items-center gap-1 transition"
                                >
                                  {revoking === ch.channel_name ? (
                                    <span>Revoking…</span>
                                  ) : (
                                    <>🔒 Revoke</>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── USERS ── */}
              {tab === 'users' && (
                <div className="space-y-3">
                  {users.map((u, i) => (
                    <div key={i} className="bg-bp-dark rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-bp-green rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {getInitial(u.name)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{u.name}</p>
                          <p className="text-gray-400 text-xs">{u.email} · {u.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          u.role === 'admin' || u.role === 'super_admin'
                            ? 'bg-yellow-900 text-yellow-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          u.is_active !== false
                            ? 'bg-green-900 text-green-400'
                            : 'bg-red-900 text-red-400'
                        }`}>
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => {
                            setTab('permissions');
                            openUserChannels(u);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300"
                        >
                          Channels
                        </button>
                        <button
                          onClick={() => handleToggleUser(u.email)}
                          className={`text-xs px-3 py-1.5 rounded-lg ${
                            u.is_active !== false
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-bp-green hover:bg-green-700 text-white'
                          }`}
                        >
                          {u.is_active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── AUDIT LOG ── */}
              {tab === 'audit' && (
                <div className="space-y-2">
                  {audit.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No audit logs yet</p>
                  ) : audit.map((log, i) => (
                    <div key={i} className="bg-bp-dark rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">{log.action}</p>
                        <p className="text-gray-500 text-xs">{log.target} · by {log.by}</p>
                      </div>
                      <span className="text-gray-600 text-xs">{log.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;