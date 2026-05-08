import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import ShiftHandover from './ShiftHandover';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../LanguageContext';
import ChannelAccess from './ChannelAccess';
import UserList from './UserList';
import AdminPanel from './AdminPanel';

const SECRET_KEY = 'bp-securedesk-aes-key-2025';
let socket = null;

function Chat({ user, onLogout }) {
  const { t } = useLanguage();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [typingUser, setTypingUser] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [emergency, setEmergency] = useState(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [accessChannel, setAccessChannel] = useState(null);
  const [unlockedChannels, setUnlockedChannels] = useState(['general']);
  const [showUserList, setShowUserList] = useState(false);
  const [dmChannels, setDmChannels] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [wordWarning, setWordWarning] = useState('');
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');

  // Inappropriate word filter
  const bannedWords = [
    'idiot', 'stupid', 'moron', 'dumb', 'hate',
    'axmaq', 'sürün', 'ahmaq',
    'дурак', 'идиот', 'тупой', 'блять', 'чёрт'
  ];

  const containsBannedWord = (text) => {
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word));
  };

  useEffect(() => {
    socket = io('http://127.0.0.1:5000', { query: { token } });
    socket.on('new_message', (msg) => {
      const decrypted = { ...msg, content: decryptMessage(msg.content) };
      setMessages(prev => [...prev, decrypted]);
    });
    socket.on('user_typing', (data) => {
      setTypingUser(`${data.name} is typing...`);
      setTimeout(() => setTypingUser(''), 2000);
    });
    socket.on('user_connected', (data) => setOnlineUsers(data.online_users));
    socket.on('user_disconnected', (data) => setOnlineUsers(data.online_users));
    socket.on('emergency_alert', (data) => {
      setEmergency(data);
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==');
      audio.play().catch(() => {});
    });
    return () => { if (socket) socket.disconnect(); };
  }, []);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/channels', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChannels(res.data);
        if (res.data.length > 0) setActiveChannel(res.data[0]);
      } catch (err) {
        console.error('Failed to fetch channels');
      }
    };
    fetchChannels();
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    if (socket) socket.emit('join_channel', { channel: activeChannel.name });
    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:5000/api/messages/${activeChannel.name}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const decrypted = res.data.map(msg => ({
          ...msg, content: decryptMessage(msg.content)
        }));
        setMessages(decrypted);
      } catch (err) {
        console.error('Failed to fetch messages');
      }
    };
    fetchMessages();
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const encryptMessage = (text) =>
    CryptoJS.AES.encrypt(text, SECRET_KEY).toString();

  const decryptMessage = (encrypted) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8) || encrypted;
    } catch { return encrypted; }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Word filter check
    if (containsBannedWord(newMessage)) {
      setWordWarning('⚠️ Your message contains inappropriate content and cannot be sent.');
      setTimeout(() => setWordWarning(''), 3000);
      return;
    }

    const encrypted = encryptMessage(newMessage);
    const timestamp = new Date().toISOString();
    if (socket) {
      socket.emit('send_message', {
        content: encrypted,
        channel: activeChannel.name,
        priority,
        timestamp
      });
    }
    try {
      await axios.post('http://127.0.0.1:5000/api/messages', {
        content: encrypted,
        channel: activeChannel.name,
        priority
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error('Failed to save message');
    }
    setNewMessage('');
    setPriority('normal');
    setWordWarning('');
  };

  const handleTyping = () => {
    if (socket && activeChannel) {
      socket.emit('typing', { channel: activeChannel.name });
    }
  };

  const sendEmergency = () => {
    if (socket && emergencyMessage.trim()) {
      socket.emit('emergency_broadcast', { message: emergencyMessage });
      setShowEmergencyModal(false);
      setEmergencyMessage('');
    }
  };

  const startDM = (targetUser) => {
    const dmName = `dm-${[user.email, targetUser.email].sort().join('-')}`;
    const dmChannel = {
      name: dmName,
      description: `DM with ${targetUser.name}`,
      icon: '💬',
      type: 'dm',
      displayName: targetUser.name
    };
    setDmChannels(prev => {
      if (prev.find(c => c.name === dmName)) return prev;
      return [...prev, dmChannel];
    });
    setActiveChannel(dmChannel);
    setUnlockedChannels(prev => [...prev, dmName]);
    setShowUserList(false);
  };

  const getPriorityStyle = (p) => {
    switch(p) {
      case 'urgent': return 'border-l-4 border-red-500 bg-red-900 bg-opacity-10';
      case 'important': return 'border-l-4 border-yellow-500 bg-yellow-900 bg-opacity-10';
      case 'confidential': return 'border-l-4 border-gray-500 bg-gray-800 bg-opacity-50';
      default: return '';
    }
  };

  const getPriorityBadge = (p) => {
    switch(p) {
      case 'urgent': return <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full ml-2">🔴 {t.urgent}</span>;
      case 'important': return <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full ml-2">🟡 {t.important}</span>;
      case 'confidential': return <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded-full ml-2">⚫ {t.confidential}</span>;
      default: return null;
    }
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex h-screen bg-bp-dark">

      {/* EMERGENCY ALERT */}
      {emergency && (
        <div className="fixed inset-0 bg-red-900 bg-opacity-95 z-50 flex items-center justify-center">
          <div className="text-center text-white p-8 max-w-lg">
            <div className="text-8xl mb-6 animate-bounce">🚨</div>
            <h1 className="text-4xl font-bold mb-4">{t.emergencyTitle}</h1>
            <p className="text-xl mb-4 bg-red-800 p-4 rounded-lg">{emergency.message}</p>
            <p className="text-red-300 mb-8">Sent by: {emergency.sender} — {emergency.department}</p>
            <button
              onClick={() => setEmergency(null)}
              className="bg-white text-red-900 font-bold px-8 py-3 rounded-lg text-lg hover:bg-red-100"
            >
              {t.acknowledge}
            </button>
          </div>
        </div>
      )}

      {/* EMERGENCY MODAL */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-bp-gray rounded-xl p-6 w-96">
            <h3 className="text-white font-bold text-lg mb-4">🚨 {t.sendEmergency}</h3>
            <p className="text-gray-400 text-sm mb-4">{t.emergencyWarning}</p>
            <textarea
              value={emergencyMessage}
              onChange={(e) => setEmergencyMessage(e.target.value)}
              placeholder={t.emergencyPlaceholder}
              className="w-full bg-bp-dark border border-red-500 text-white rounded-lg px-4 py-3 mb-4 h-24 resize-none focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
              >
                {t.cancel}
              </button>
              <button
                onClick={sendEmergency}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-bold"
              >
                {t.sendAlert}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-64 bg-bp-gray flex flex-col">

        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img src="/bplogo.png" alt="BP" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-white font-bold text-sm">{t.appName}</h1>
              <p className="text-gray-400 text-xs">BP Azerbaijan</p>
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div className="px-4 py-2 bg-green-900 bg-opacity-30 border-b border-gray-700">
          <p className="text-green-400 text-xs flex items-center gap-1">
            🔒 {t.encrypted}
          </p>
        </div>

        {/* Online count */}
        <div className="px-4 py-2 border-b border-gray-700">
          <p className="text-gray-400 text-xs">
            🟢 {onlineUsers.length} {t.online}
          </p>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-2">
          <p className="text-gray-500 text-xs uppercase px-4 py-2 font-semibold">{t.channels}</p>
          {channels.map(channel => {
            const isUnlocked = channel.type === 'public' || user?.role === 'admin' || unlockedChannels.includes(channel.name);
            return (
              <button
                key={channel.name}
                onClick={() => {
                  if (isUnlocked) {
                    setActiveChannel(channel);
                  } else {
                    setAccessChannel(channel);
                  }
                }}
                className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${
                  activeChannel?.name === channel.name
                    ? 'bg-bp-green bg-opacity-20 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span>
                  <span className="mr-2">{channel.icon}</span>
                  # {channel.name}
                </span>
                {!isUnlocked && <span className="text-xs">🔒</span>}
              </button>
            );
          })}

          {/* DM Section */}
          <div className="px-4 py-2 border-t border-gray-700 mt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-gray-500 text-xs uppercase font-semibold">
                Direct Messages
              </p>
              <button
                onClick={() => setShowUserList(true)}
                className="text-gray-400 hover:text-white text-lg leading-none"
                title="New DM"
              >
                +
              </button>
            </div>
            {dmChannels.map(channel => (
              <button
                key={channel.name}
                onClick={() => setActiveChannel(channel)}
                className={`w-full text-left px-2 py-1.5 text-sm rounded transition ${
                  activeChannel?.name === channel.name
                    ? 'bg-bp-green bg-opacity-20 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                💬 {channel.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="p-3 border-t border-gray-700 space-y-2">
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
          >
            🚨 {t.emergencyBroadcast}
          </button>
          {activeChannel?.name === 'acg-operations' && (
            <button
              onClick={() => setShowHandover(true)}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              📋 {t.shiftHandover}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAdmin(true)}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              ⚙️ Admin Panel
            </button>
          )}
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bp-green rounded-full flex items-center justify-center text-white text-sm font-bold">
              {getInitial(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-gray-400 text-xs truncate">{user?.department}</p>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-red-400 text-xs transition"
              title={t.logout}
            >
              ⏻
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col">
        {activeChannel && (
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">
                {activeChannel.icon} {activeChannel.type === 'dm' ? activeChannel.displayName : `#${activeChannel.name}`}
              </h2>
              <p className="text-gray-400 text-sm">{activeChannel.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <div className="text-green-400 text-xs flex items-center gap-1">
                🔒 {t.endToEnd}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-4xl mb-4">🔒</p>
              <p>{t.noMessages}</p>
              <p className="text-xs mt-2">{t.allEncrypted}</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 rounded-lg p-2 ${getPriorityStyle(msg.priority)}`}>
              <div className="w-8 h-8 bg-bp-green rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {getInitial(msg.sender_name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-white text-sm font-semibold">{msg.sender_name}</span>
                  <span className="text-gray-500 text-xs">{msg.department}</span>
                  <span className="text-gray-600 text-xs">{formatTime(msg.timestamp)}</span>
                  {getPriorityBadge(msg.priority)}
                  <span className="text-green-600 text-xs ml-auto">🔒</span>
                </div>
                <p className="text-gray-300 text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {typingUser && (
          <div className="px-6 py-1">
            <p className="text-gray-500 text-xs italic">{typingUser}</p>
          </div>
        )}

        {/* Word warning */}
        {wordWarning && (
          <div className="mx-4 mb-2 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm">
            {wordWarning}
          </div>
        )}

        <div className="p-4 border-t border-gray-700">
          <form onSubmit={sendMessage} className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-bp-gray border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-green"
            >
              <option value="normal">🔵 {t.normal}</option>
              <option value="important">🟡 {t.important}</option>
              <option value="urgent">🔴 {t.urgent}</option>
              <option value="confidential">⚫ {t.confidential}</option>
            </select>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
                if (wordWarning) setWordWarning('');
              }}
              placeholder={`${t.messagePlaceholder} #${activeChannel?.name || ''}...`}
              className="flex-1 bg-bp-gray border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-bp-green"
            />
            <button
              type="submit"
              className="bg-bp-green hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition"
            >
              {t.send}
            </button>
          </form>
          <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
            🔒 {t.messagesEncrypted}
          </p>
        </div>
      </div>

      {accessChannel && (
        <ChannelAccess
          channel={accessChannel}
          userDepartment={user?.department}
          onAccessGranted={(channelName) => {
            setUnlockedChannels(prev => [...prev, channelName]);
            const ch = channels.find(c => c.name === channelName);
            if (ch) setActiveChannel(ch);
            setAccessChannel(null);
          }}
          onClose={() => setAccessChannel(null)}
        />
      )}

      {showUserList && (
        <UserList
          currentUser={user}
          onStartDM={startDM}
          onClose={() => setShowUserList(false)}
        />
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {showHandover && <ShiftHandover onClose={() => setShowHandover(false)} />}
    </div>
  );
}

export default Chat;