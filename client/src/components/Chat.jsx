import API_BASE from '../config';
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
import { isProfane } from '../wordFilter';
import MusterRoll from './MusterRoll';
import WeatherWidget from './WeatherWidget';
import SearchPanel from './SearchPanel';
import NotificationSettings, { loadNotifSettings, saveNotifSettings } from './NotificationSettings';
import AISummary from './AISummary';
import TaskManager from './TaskManager';
import SecurityDashboard from './SecurityDashboard';
import IncidentReport from './IncidentReport';

const SECRET_KEY = 'bp-securedesk-aes-key-2025';
let socket = null;

function Chat({ user, onLogout }) {
  const { t } = useLanguage();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [selfDestruct, setSelfDestruct] = useState(0); // 0 = off, seconds
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
  const [showMuster, setShowMuster] = useState(false);
  const [activeMuster, setActiveMuster] = useState(null);
  const [showWeather, setShowWeather] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showAISummary, setShowAISummary] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showIncidents, setShowIncidents] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [notifSettings, setNotifSettings] = useState(loadNotifSettings);
  const [readReceipts, setReadReceipts] = useState({}); // { msg_id: [{name, time}] }
  const [wordWarning, setWordWarning] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  // Close tools menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.tools-menu-container')) setShowToolsMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    socket = io(API_BASE, { query: { token } });
    socket.on('new_message', (msg) => {
      // Skip already-expired messages
      if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return;
      const decrypted = { ...msg, content: decryptMessage(msg.content), isNew: true };
      setMessages(prev => [...prev, decrypted]);
      // Auto-mark all messages as seen on receipt
      if (msg._id && socket) socket.emit('mark_seen', { msg_id: msg._id });
      // Smart notification sound
      const isDM = msg.channel?.startsWith('dm-');
      const s = loadNotifSettings();
      if (!s.muteAll && s.sound) {
        const muted = s.mutedChannels || [];
        if (!muted.includes(msg.channel)) {
          const inQuiet = (() => {
            if (!s.quietHoursEnabled) return false;
            const now = new Date();
            const cur = now.getHours() * 60 + now.getMinutes();
            const [fh, fm] = (s.quietFrom || '22:00').split(':').map(Number);
            const [th, tm] = (s.quietTo || '07:00').split(':').map(Number);
            const from = fh * 60 + fm, to = th * 60 + tm;
            return from > to ? (cur >= from || cur <= to) : (cur >= from && cur <= to);
          })();
          if (!inQuiet) {
            const play = s.focusMode
              ? (msg.priority === 'urgent' || isDM)
              : (msg.priority === 'urgent' ? s.urgentSound
                : msg.priority === 'important' ? s.importantSound
                : isDM ? s.dmSound
                : s.normalSound);
            if (play) {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==');
              audio.play().catch(() => {});
            }
          }
        }
      }
    });
    socket.on('user_typing', (data) => {
      setTypingUser(`${data.name} is typing...`);
      setTimeout(() => setTypingUser(''), 2000);
    });
    socket.on('user_connected', (data) => setOnlineUsers(data.online_users));
    socket.on('user_disconnected', (data) => setOnlineUsers(data.online_users));
    socket.on('message_seen', (data) => {
      // data: { msg_id, reader_name, reader_email }
      setReadReceipts(prev => {
        const existing = prev[data.msg_id] || [];
        // avoid duplicates
        if (existing.find(r => r.email === data.reader_email)) return prev;
        return {
          ...prev,
          [data.msg_id]: [...existing, { name: data.reader_name, email: data.reader_email, time: data.time }]
        };
      });
    });

    socket.on('muster_started', (data) => {
      setActiveMuster(data);
      setShowMuster(true);
    });
    socket.on('muster_updated', (data) => setActiveMuster(data));
    socket.on('muster_ended', () => setActiveMuster(null));
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
        const res = await axios.get(`${API_BASE}/api/channels`, {
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
          `${API_BASE}/api/messages/${activeChannel.name}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const decrypted = res.data.map(msg => ({
          ...msg, content: decryptMessage(msg.content)
        }));
        setMessages(decrypted);
        // Mark all messages as seen (delay to ensure socket ready)
        setTimeout(() => {
          decrypted.forEach(msg => {
            if (msg._id && socket) socket.emit('mark_seen', { msg_id: msg._id });
          });
        }, 500);
      } catch (err) {
        console.error('Failed to fetch messages');
      }
    };
    fetchMessages();
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Self-destruct cleanup — check every second, remove expired messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const filtered = prev.filter(msg => {
          if (!msg.expires_at) return true;
          return new Date(msg.expires_at).getTime() > now;
        });
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const encryptMessage = (text) =>
    CryptoJS.AES.encrypt(text, SECRET_KEY).toString();

  const decryptMessage = (encrypted) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8) || encrypted;
    } catch { return encrypted; }
  };

  const playSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==');
    audio.play().catch(() => {});
  };

  const shouldNotify = (priority, channelName, isDM = false) => {
    const s = notifSettings;
    if (s.muteAll) return false;
    if (s.mutedChannels.includes(channelName)) return false;
    // Quiet hours check
    if (s.quietHoursEnabled) {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const [fh, fm] = s.quietFrom.split(':').map(Number);
      const [th, tm] = s.quietTo.split(':').map(Number);
      const from = fh * 60 + fm;
      const to = th * 60 + tm;
      const inQuiet = from > to ? (cur >= from || cur <= to) : (cur >= from && cur <= to);
      if (inQuiet) return false;
    }
    if (s.focusMode) return priority === 'urgent' || isDM;
    if (priority === 'urgent') return s.urgentSound;
    if (priority === 'important') return s.importantSound;
    if (isDM) return s.dmSound;
    return s.normalSound;
  };

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!activeChannel) return;

    if (isProfane(newMessage)) {
      setWordWarning('⚠️ Your message contains inappropriate content and cannot be sent.');
      setTimeout(() => setWordWarning(''), 3000);
      return;
    }

    const encrypted = encryptMessage(newMessage);
    const timestamp = new Date().toISOString();
    const expires_at = selfDestruct > 0
      ? new Date(Date.now() + selfDestruct * 1000).toISOString()
      : null;
    if (socket) {
      socket.emit('send_message', {
        content: encrypted,
        channel: activeChannel.name,
        priority,
        timestamp,
        expires_at
      });
    }
    try {
      await axios.post(`${API_BASE}/api/messages`, {
        content: encrypted,
        channel: activeChannel.name,
        priority,
        expires_at
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error('Failed to save message');
    }
    setNewMessage('');
    setPriority('normal');
    setSelfDestruct(0);
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const sendFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fileContent = `📎 __FILE__${JSON.stringify({
        name: selectedFile.name,
        type: selectedFile.type,
        url: res.data.url
      })}`;
      const encrypted = encryptMessage(fileContent);
      if (socket) {
        socket.emit('send_message', {
          content: encrypted,
          channel: activeChannel.name,
          priority: 'normal',
          timestamp: new Date().toISOString()
        });
      }
      await axios.post(`${API_BASE}/api/messages`, {
        content: encrypted,
        channel: activeChannel.name,
        priority: 'normal'
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error('Upload failed');
    } finally {
      setUploading(false);
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
      case 'urgent': return 'priority-urgent';
      case 'important': return 'priority-important';
      case 'confidential': return 'priority-confidential';
      default: return '';
    }
  };

  const getPriorityBadge = (p) => {
    switch(p) {
      case 'urgent': return <span className="badge-urgent ml-2">{t.urgent}</span>;
      case 'important': return <span className="badge-important ml-2">{t.important}</span>;
      case 'confidential': return <span className="badge-confidential ml-2">{t.confidential}</span>;
      default: return null;
    }
  };

  const renderMessageContent = (content) => {
    if (content?.startsWith('📎 __FILE__')) {
      try {
        const fileData = JSON.parse(content.replace('📎 __FILE__', ''));
        const isImage = fileData.type?.startsWith('image/');
        const isVideo = fileData.type?.startsWith('video/');
        return (
          <div className="mt-1">
            {isImage && (
              <img
                src={`${API_BASE}${fileData.url}`}
                alt={fileData.name}
                className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90"
                onClick={() => window.open(`${API_BASE}${fileData.url}`)}
              />
            )}
            {isVideo && (
              <video
                src={`${API_BASE}${fileData.url}`}
                controls
                className="max-w-xs max-h-48 rounded-lg"
              />
            )}
            {!isImage && !isVideo && (
              <a
                href={`${API_BASE}${fileData.url}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white hover:bg-gray-600 w-fit"
              >
                📎 {fileData.name}
              </a>
            )}
          </div>
        );
      } catch {
        return <p className="text-sm leading-relaxed" style={{color:"var(--text-secondary)"}}>{content}</p>;
      }
    }
    return <p className="text-sm leading-relaxed" style={{color:"var(--text-secondary)"}}>{content}</p>;
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const jumpToChannel = (channelName) => {
    const ch = channels.find(c => c.name === channelName);
    if (ch) setActiveChannel(ch);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="flex flex-col h-screen" style={{background:"var(--surface-0)"}}>

      {/* Toast notification */}
      {toast && (
        <div className="toast fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-medium shadow-panel"
          style={{
            background: toast.type === 'error' ? 'rgba(255,68,68,0.15)' : 'var(--surface-3)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(255,68,68,0.3)' : 'var(--border)'}`,
            color: toast.type === 'error' ? '#FF6B6B' : 'var(--text-primary)',
            maxWidth: '300px'
          }}>
          {toast.msg}
        </div>
      )}

      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile top bar */}
      <div style={{display: isMobile ? "flex" : "none", alignItems:"center", gap:"12px", padding:"10px 16px", borderBottom:"1px solid var(--border)", background:"var(--surface-1)", position:"sticky", top:0, zIndex:50}}>
        <button onClick={() => setSidebarOpen(true)}
          className="btn-ghost px-2.5 py-2 text-lg leading-none">☰</button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{background:"linear-gradient(135deg,#007A3D,#00A650)"}}>
            <img src="/bplogo.png" alt="BP" className="w-4 h-4 object-contain" />
          </div>
          <span className="font-semibold text-sm text-white">
            {activeChannel ? `#${activeChannel.name}` : 'SecureDesk'}
          </span>
        </div>
        <span className="enc-badge text-xs">🔒 E2E</span>
      </div>

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
          <div className="rounded-xl p-6 w-96 scale-in" style={{background:"var(--surface-2)",border:"1px solid var(--border)"}}>
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
      <div className="flex flex-1 overflow-hidden">
      <div className={`w-60 flex-col sidebar`} style={{display: isMobile ? "none" : "flex"}}>

        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-3" style={{borderBottom:"1px solid var(--border)"}}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#007A3D,#00A650)"}}><img src="/bplogo.png" alt="BP" className="w-5 h-5 object-contain" /></div>
            <div>
              <div><p className="text-white font-semibold text-sm leading-none">SecureDesk</p><p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>BP Azerbaijan</p></div>
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div className="px-4 py-2" style={{borderBottom:"1px solid var(--border)"}}><span className="enc-badge">🔒 {t.encrypted}</span></div>

        {/* Online count */}
        <div className="px-4 py-2 flex items-center gap-2" style={{borderBottom:"1px solid var(--border)"}}><span className="status-online"></span><span className="text-xs" style={{color:"var(--text-secondary)"}}>{onlineUsers.length} {t.online}</span></div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-2">
          <p className="section-label">{t.channels}</p>
          {channels.map(channel => {
            const isUnlocked = channel.type === 'public' || isAdmin || unlockedChannels.includes(channel.name);
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
className={`sidebar-channel w-full text-left ${activeChannel?.name === channel.name ? 'active' : ''}`}
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
                className={`sidebar-channel w-full text-left ${activeChannel?.name === channel.name ? 'active' : ''}`}
              >
                💬 {channel.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Tools Menu */}
        <div className="p-3 border-t border-gray-700">
          {/* Emergency — always visible, standalone */}
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="w-full text-sm font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2 mb-2" style={{background:"rgba(255,68,68,0.15)",border:"1px solid rgba(255,68,68,0.3)",color:"#FF6B6B"}}
          >
            🚨 {t.emergencyBroadcast}
          </button>

          {/* Tools dropdown */}
          <div className="relative tools-menu-container">
            <button
              onClick={() => setShowToolsMenu(prev => !prev)}
              className="btn-ghost w-full text-sm font-semibold py-2 flex items-center justify-between px-3"
            >
              <span className="flex items-center gap-2">
                ⚙️ Tools
                {activeMuster && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 animate-pulse">LIVE</span>}
                {(notifSettings.muteAll || notifSettings.focusMode) && (
                  <span className="bg-yellow-600 text-white text-xs rounded-full px-1.5 py-0.5">
                    {notifSettings.muteAll ? '🔕' : '🎯'}
                  </span>
                )}
              </span>
              <span className="text-gray-500">{showToolsMenu ? '▲' : '▼'}</span>
            </button>

            {showToolsMenu && (
              <div className="absolute bottom-10 left-0 right-0 rounded-xl overflow-hidden z-10 drop-in" style={{background:"var(--surface-3)",border:"1px solid var(--border)",boxShadow:"0 16px 48px rgba(0,0,0,0.6)"}}>
                {[
                  { icon: '📋', label: 'Incident Report',    action: () => { setShowIncidents(true); setShowToolsMenu(false); } },
                  { icon: '🧑‍🤝‍🧑', label: 'Muster Roll Call',   action: () => { setShowMuster(true); setShowToolsMenu(false); } },
                  { icon: '🌊', label: 'Caspian Conditions', action: () => { setShowWeather(true); setShowToolsMenu(false); } },
                  { icon: '✅', label: 'Task Manager',       action: () => { setShowTasks(true); setShowToolsMenu(false); } },
                  { icon: '🔔', label: `Notifications${notifSettings.muteAll ? ' (Muted)' : notifSettings.focusMode ? ' (Focus)' : ''}`, action: () => { setShowNotifSettings(true); setShowToolsMenu(false); } },
                  ...(activeChannel?.name === 'acg-operations' ? [{ icon: '📋', label: t.shiftHandover, action: () => { setShowHandover(true); setShowToolsMenu(false); } }] : []),
                  ...(isAdmin ? [
                    { icon: '🛡️', label: 'Security Dashboard', action: () => { setShowSecurity(true); setShowToolsMenu(false); } },
                    { icon: '⚙️', label: 'Admin Panel',        action: () => { setShowAdmin(true); setShowToolsMenu(false); } },
                  ] : []),
                ].map((item, i) => (
                  <button key={i} onClick={item.action}
                    className="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-3" style={{color:"var(--text-secondary)",borderBottom:"1px solid var(--border)"}}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-3" style={{borderTop:"1px solid var(--border)",background:"var(--surface-1)"}}>
          <div className="flex items-center gap-3">
            <div className="avatar" style={{width:"32px",height:"32px",fontSize:"0.75rem"}}>
              {getInitial(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{user?.name}</p>
              <p className="text-xs truncate" style={{color:"var(--text-muted)"}}>{user?.department}</p>
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

      {/* Mobile sidebar drawer */}
      <div className={`sidebar-drawer sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-4 flex items-center justify-between" style={{borderBottom:"1px solid var(--border)"}}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{background:"linear-gradient(135deg,#007A3D,#00A650)"}}>
              <img src="/bplogo.png" alt="BP" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold text-white text-sm">SecureDesk</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="px-4 py-2"><span className="enc-badge">🔒 AES-256 Encrypted</span></div>
        <div className="flex items-center gap-2 px-4 py-2" style={{borderBottom:"1px solid var(--border)"}}>
          <span className="status-online"></span>
          <span className="text-xs" style={{color:"var(--text-secondary)"}}>{onlineUsers.length} online</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <p className="section-label">CHANNELS</p>
          {channels.map(channel => {
            const isUnlocked = channel.type === 'public' || isAdmin || unlockedChannels.includes(channel.name);
            return (
              <button key={channel.name}
                onClick={() => { if (isUnlocked) { setActiveChannel(channel); setSidebarOpen(false); } else { setAccessChannel(channel); setSidebarOpen(false); } }}
                className={`sidebar-channel w-full text-left ${activeChannel?.name === channel.name ? 'active' : ''}`}>
                <span className="mr-1">{channel.icon}</span>
                # {channel.name}
                {!isUnlocked && <span className="ml-auto text-xs opacity-40">🔒</span>}
              </button>
            );
          })}
          <div className="px-4 pt-3 pb-1" style={{borderTop:"1px solid var(--border)",marginTop:"8px"}}>
            <div className="flex items-center justify-between mb-1">
              <p className="section-label" style={{padding:0}}>DIRECT MESSAGES</p>
              <button onClick={() => { setShowUserList(true); setSidebarOpen(false); }}
                className="text-gray-400 hover:text-white text-lg leading-none">+</button>
            </div>
            {dmChannels.map(channel => (
              <button key={channel.name} onClick={() => { setActiveChannel(channel); setSidebarOpen(false); }}
                className={`sidebar-channel w-full text-left ${activeChannel?.name === channel.name ? 'active' : ''}`}>
                💬 {channel.displayName}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3" style={{borderTop:"1px solid var(--border)"}}>
          <button onClick={() => { setShowEmergencyModal(true); setSidebarOpen(false); }}
            className="w-full text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2 mb-2"
            style={{background:"rgba(255,68,68,0.15)",border:"1px solid rgba(255,68,68,0.3)",color:"#FF6B6B"}}>
            🚨 Emergency Broadcast
          </button>
          <button onClick={() => { setShowToolsMenu(p => !p); }}
            className="btn-ghost w-full text-sm font-semibold py-2 flex items-center justify-between px-3">
            <span>⚙️ Tools</span><span style={{color:"var(--text-muted)"}}>▲</span>
          </button>
        </div>
        <div className="p-3 flex items-center gap-3" style={{borderTop:"1px solid var(--border)"}}>
          <div className="avatar" style={{width:"32px",height:"32px",fontSize:"0.75rem"}}>{getInitial(user?.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{user?.name}</p>
            <p className="text-xs truncate" style={{color:"var(--text-muted)"}}>{user?.department}</p>
          </div>
          <button onClick={onLogout} className="text-gray-500 hover:text-red-400 text-xs transition">⏻</button>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col" style={{minWidth:0, overflow:"hidden"}}>
        {activeChannel && (
          <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:"1px solid var(--border)",background:"var(--surface-1)"}}>
            <div>
              <h2 className="font-semibold text-white" style={{fontSize:"0.95rem"}}>
                {activeChannel.icon} {activeChannel.type === 'dm' ? activeChannel.displayName : `#${activeChannel.name}`}
              </h2>
              <p className="text-xs mt-0.5" style={{color:"var(--text-secondary)"}}>{activeChannel.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSearch(true)}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5"
                title="Search messages"
              >
                🔍 Search
              </button>
              <button
                onClick={() => setShowAISummary(true)}
                className="px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 font-medium" style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)",color:"#A78BFA"}}
                title="AI Summary"
              >
                🤖 AI Summary
              </button>
              <LanguageSelector />
              <span className="enc-badge">🔒 {t.endToEnd}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-center mt-20" style={{color:"var(--text-muted)"}}>
              <p className="text-4xl mb-4">🔒</p>
              <p>{t.noMessages}</p>
              <p className="text-xs mt-2">{t.allEncrypted}</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`message-row ${getPriorityStyle(msg.priority)} ${msg.isNew ? "msg-animate" : ""}`}>
              <div className="avatar">{getInitial(msg.sender_name)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm" style={{color:"var(--text-primary)"}}>{msg.sender_name}</span>
                  <span className="text-xs" style={{color:"var(--text-muted)"}}>{msg.department}</span>
                  <span className="text-xs font-mono" style={{color:"var(--text-muted)"}}>{formatTime(msg.timestamp)}</span>
                  {getPriorityBadge(msg.priority)}
                  <span className="text-xs ml-auto opacity-30" style={{color:"var(--bp-green)"}}>🔒</span>
                </div>
                {/* Self-destruct timer display */}
                {msg.expires_at && (() => {
                  const secsLeft = Math.max(0, Math.round((new Date(msg.expires_at).getTime() - Date.now()) / 1000));
                  const pct = msg.selfDestructSecs ? (secsLeft / msg.selfDestructSecs) * 100 : 50;
                  return (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-red-400 font-mono animate-pulse">
                        💣 Deletes in {secsLeft}s
                      </span>
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-1 bg-red-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, secsLeft > 0 ? (secsLeft / 300) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
                {renderMessageContent(msg.content)}
                {/* Read Receipts — all messages */}
                {msg._id && (
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {readReceipts[msg._id] && readReceipts[msg._id].length > 0 ? (
                      <>
                        <span className="text-xs text-gray-500">👁 Seen by:</span>
                        {readReceipts[msg._id].slice(0, 5).map((r, i) => (
                          <span key={i} title={`Seen at ${r.time}`}
                            className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full border border-gray-600">
                            {r.name.split(' ')[0]}
                          </span>
                        ))}
                        {readReceipts[msg._id].length > 5 && (
                          <span className="text-xs text-gray-500">+{readReceipts[msg._id].length - 5} more</span>
                        )}
                        <span className="text-xs text-blue-400 ml-1 font-bold">✓✓</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <span>✓</span> <span>Delivered — waiting for reads</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {typingUser && (
          <div className="px-5 py-1.5 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
            <p className="text-xs" style={{color:"var(--text-muted)"}}>{typingUser}</p>
          </div>
        )}

        {/* File Preview */}
        {selectedFile && (
          <div className="mx-4 mb-2 rounded-lg px-3 py-2 flex items-center justify-between" style={{background:"var(--surface-3)",border:"1px solid var(--border)"}}>
            <div className="flex items-center gap-2">
              {filePreview ? (
                <img src={filePreview} alt="preview" className="w-10 h-10 rounded object-cover" />
              ) : (
                <span className="text-2xl">📎</span>
              )}
              <div>
                <p className="text-white text-xs font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-xs">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedFile(null); setFilePreview(null); }}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Word warning */}
        {wordWarning && (
          <div className="mx-4 mb-2 px-4 py-2 rounded-lg text-sm" style={{background:"rgba(255,68,68,0.08)",border:"1px solid rgba(255,68,68,0.25)",color:"#FF6B6B"}}>
            {wordWarning}
          </div>
        )}

        <div className="px-4 py-3" style={{borderTop:"1px solid var(--border)",background:"var(--surface-1)"}}>
          <form
            onSubmit={selectedFile ? (e) => { e.preventDefault(); sendFile(); } : sendMessage}
            className="flex gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost px-3 py-2"
              title="Attach file"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile && (
              <>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="text-sm rounded-lg px-3 py-2 focus:outline-none" style={{background:"var(--surface-3)",border:"1px solid var(--border)",color:"var(--text-secondary)"}}
                >
                  <option value="normal">🔵 {t.normal}</option>
                  <option value="important">🟡 {t.important}</option>
                  <option value="urgent">🔴 {t.urgent}</option>
                  <option value="confidential">⚫ {t.confidential}</option>
                </select>
                {/* Self-destruct timer picker */}
                <select
                  value={selfDestruct}
                  onChange={(e) => setSelfDestruct(Number(e.target.value))}
                  className="text-sm rounded-lg px-2 py-2 focus:outline-none" style={{background:"var(--surface-3)",border:"1px solid var(--border)",color:"var(--text-secondary)"}}
                  title="Self-destruct timer"
                >
                  <option value={0}>💬 Keep</option>
                  <option value={30}>💣 30s</option>
                  <option value={60}>💣 1min</option>
                  <option value={300}>💣 5min</option>
                  <option value={3600}>💣 1hr</option>
                  <option value={86400}>💣 24hr</option>
                </select>
              </>
            )}

            {selectedFile ? (
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 bg-bp-green hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition"
              >
                {uploading ? 'Uploading...' : `Send ${selectedFile.name}`}
              </button>
            ) : (
              <>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                    if (wordWarning) setWordWarning('');
                  }}
                  placeholder={`${t.messagePlaceholder} #${activeChannel?.name || ''}...`}
                  className="chat-input flex-1"
                />
                <button
                  type="submit"
                  className="btn-primary px-5 py-2"
                >
                  {t.send}
                </button>
              </>
            )}
          </form>
          <p className="text-xs mt-2 flex items-center gap-1" style={{color:"var(--text-muted)"}}>🔒 {t.messagesEncrypted}</p>
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

      </div>{/* end row */}

      {showWeather && <WeatherWidget onClose={() => setShowWeather(false)} />}

      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} onJumpToChannel={jumpToChannel} />}

      {showTasks && <TaskManager user={user} onClose={() => setShowTasks(false)} />}

      {showSecurity && <SecurityDashboard onClose={() => setShowSecurity(false)} />}

      {showIncidents && <IncidentReport user={user} onClose={() => setShowIncidents(false)} />}

      {showAISummary && (
        <AISummary
          messages={messages}
          channelName={activeChannel?.name || ''}
          onClose={() => setShowAISummary(false)}
        />
      )}

      {showNotifSettings && (
        <NotificationSettings
          onClose={() => setShowNotifSettings(false)}
          onSettingsChange={(s) => setNotifSettings(s)}
        />
      )}

      {showMuster && (
        <MusterRoll
          socket={socket}
          user={user}
          activeMuster={activeMuster}
          onClose={() => setShowMuster(false)}
        />
      )}
    </div>
  );
}

export default Chat;