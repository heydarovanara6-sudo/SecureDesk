import React, { useState } from 'react';
import axios from 'axios';
import API_BASE from '../config';

function UserList({ currentUser, onStartDM, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const token = localStorage.getItem('token');

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.filter(u => u.email !== currentUser.email));
      } catch (err) {
        console.error('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
      <div className="rounded-xl w-96 flex flex-col" style={{background:'var(--surface-2)', border:'1px solid var(--border)', maxHeight:'520px', width:'420px'}}>
        <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid var(--border)'}}>
          <h3 className="text-white font-bold">💬 New Direct Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {/* Search box */}
        <div className="px-3 py-2" style={{borderBottom:'1px solid var(--border)'}}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people..."
            autoFocus
            className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none"
            style={{background:'var(--surface-3)', border:'1px solid var(--border)', color:'var(--text-primary)', fontSize:'16px'}}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-gray-400 text-center p-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center p-4">{search ? 'No users found' : 'No other users found'}</p>
          ) : (
            filtered.map(user => (
              <button key={user.email} onClick={() => onStartDM(user)}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition text-left"
                style={{':hover': {background:'var(--surface-3)'}}}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{background:'linear-gradient(135deg,#007A3D,#00A650)'}}>
                  {getInitial(user.name)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-xs" style={{color:'var(--text-muted)'}}>{user.department}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default UserList;