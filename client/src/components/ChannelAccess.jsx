import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

function ChannelAccess({ channel, userDepartment, onAccessGranted, onClose }) {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check if user auto-qualifies for this channel
  const userDeptMatch = channel.department &&
    userDepartment?.toLowerCase().includes(channel.department.toLowerCase());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === channel.password) {
      onAccessGranted(channel.name);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  // Auto-grant if department matches
  if (userDeptMatch) {
    onAccessGranted(channel.name);
    return null;
  }

  // Restricted channel - request only
  if (channel.type === 'restricted') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
        <div className="bg-bp-gray rounded-xl p-6 w-96">
          <h3 className="text-white font-bold text-lg mb-2">
            🔐 {channel.icon} #{channel.name}
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            This channel is restricted to the {channel.department} department.
            Contact your administrator to request access.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
            >
              Close
            </button>
            <button
              onClick={() => {
                alert('Access request sent to admin!');
                onClose();
              }}
              className="flex-1 bg-bp-green text-white py-2 rounded-lg hover:bg-green-700 font-bold"
            >
              Request Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Password protected channel
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
      <div className="bg-bp-gray rounded-xl p-6 w-96">
        <h3 className="text-white font-bold text-lg mb-2">
          🔐 #{channel.name}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          This channel is restricted to the <strong className="text-white">{channel.department}</strong> department.
          Enter the channel password to join.
        </p>

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-3 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter channel password..."
            autoFocus
            className="w-full bg-bp-dark border border-gray-600 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-bp-green"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-bp-green text-white py-2 rounded-lg hover:bg-green-700 font-bold"
            >
              Join Channel
            </button>
          </div>
        </form>

        <p className="text-gray-600 text-xs mt-4 text-center">
          Don't have the password? Contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default ChannelAccess;