import React, { useState } from 'react';
import axios from 'axios';
import API_BASE from '../config';

function ChannelAccess({ channel, userDepartment, onAccessGranted, onClose }) {
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');

  const userDeptMatch = channel.department &&
    userDepartment?.toLowerCase().includes(channel.department.toLowerCase());

  if (userDeptMatch) {
    onAccessGranted(channel.name);
    return null;
  }

  const handleRequest = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/channels/request`,
        { channel_name: channel.name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequested(true);
    } catch (err) {
      setRequested(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
      <div className="bg-bp-gray rounded-xl p-6 w-96">
        <h3 className="text-white font-bold text-lg mb-2">
          🔐 {channel.icon} #{channel.name}
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          This channel is restricted to the <strong className="text-white">{channel.department || 'Executive'}</strong> department.
          {!requested && ' Request access from the administrator.'}
        </p>

        {requested ? (
          <div className="text-center">
            <p className="text-green-400 text-lg mb-2">✅ Request sent!</p>
            <p className="text-gray-400 text-sm mb-4">
              The admin will review your request. You'll get access once approved.
            </p>
            <button onClick={onClose} className="w-full bg-bp-green text-white py-2 rounded-lg">
              Close
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600">
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={loading}
              className="flex-1 bg-bp-green text-white py-2 rounded-lg hover:bg-green-700 font-bold"
            >
              {loading ? 'Sending...' : 'Request Access'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelAccess;
