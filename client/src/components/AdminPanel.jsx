import API_BASE from '../config';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, usersRes, auditRes] = await Promise.all([
        axios.get('${API_BASE}/api/admin/requests', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('${API_BASE}/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('${API_BASE}/api/admin/audit', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRequests(reqRes.data);
      setUsers(usersRes.data);
      setAudit(auditRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRequest = async (email, channel, action) => {
    try {
      await axios.post(
        `${API_BASE}/api/admin/requests/${email}/${channel}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (err) {
      console.error('Failed to handle request');
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
      console.error('Failed to toggle user');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-bp-gray rounded-2xl w-full max-w-3xl max-h-screen flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl">⚙️ Admin Panel</h2>
            <p className="text-gray-400 text-sm">BP Azerbaijan — SecureDesk Management</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'requests', label: `Access Requests ${pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}` },
            { id: 'users', label: 'Users' },
            { id: 'audit', label: 'Audit Log' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-3 text-sm font-medium transition ${
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
              {/* ACCESS REQUESTS */}
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
                            >
                              Deny
                            </button>
                            <button
                              onClick={() => handleRequest(req.user_email, req.channel_name, 'approve')}
                              className="px-3 py-1.5 bg-bp-green hover:bg-green-700 text-white text-xs rounded-lg font-bold"
                            >
                              Approve
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            req.status === 'approved'
                              ? 'bg-green-900 text-green-400'
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

              {/* USERS */}
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
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          u.role === 'admin'
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

              {/* AUDIT LOG */}
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