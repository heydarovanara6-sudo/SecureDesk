import React, { useState } from 'react';
import axios from 'axios';
import API_BASE from '../config';

function UserList({ currentUser, onStartDM, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
      <div className="bg-bp-gray rounded-xl w-96 max-h-96 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-bold">💬 New Direct Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-gray-400 text-center p-4">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-center p-4">No other users found</p>
          ) : (
            users.map(user => (
              <button key={user.email} onClick={() => onStartDM(user)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition text-left">
                <div className="w-8 h-8 bg-bp-green rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {getInitial(user.name)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-gray-400 text-xs">{user.department}</p>
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