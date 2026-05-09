import React, { useState, useCallback } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'bp-securedesk-aes-key-2025';

const CHANNELS = [
  'general','acg-operations','shah-deniz',
  'hr-confidential','legal','finance','executive','it-security'
];

const PRIORITIES = [
  { value: '', label: 'All Priorities' },
  { value: 'normal', label: '🔵 Normal' },
  { value: 'important', label: '🟡 Important' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'confidential', label: '⚫ Confidential' },
];

const decryptMessage = (encrypted) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || encrypted;
  } catch { return encrypted; }
};

const getPriorityBadge = (p) => {
  const map = {
    urgent: 'bg-red-500 text-white',
    important: 'bg-yellow-500 text-black',
    confidential: 'bg-gray-600 text-white',
    normal: 'bg-blue-600 text-white',
  };
  return map[p] || map.normal;
};

const formatDate = (ts) => {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return ts; }
};

function SearchPanel({ onClose, onJumpToChannel }) {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('');
  const [sender, setSender] = useState('');
  const [priority, setPriority] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  const token = localStorage.getItem('token');

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (channel) params.set('channel', channel);
      if (sender) params.set('sender', sender);
      if (priority) params.set('priority', priority);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await axios.get(
        `http://127.0.0.1:5000/api/messages/search?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Decrypt content client-side, then filter by query text
      const decrypted = res.data.map(msg => ({
        ...msg,
        content: decryptMessage(msg.content)
      }));

      const filtered = query.trim()
        ? decrypted.filter(msg =>
            msg.content.toLowerCase().includes(query.toLowerCase()) ||
            msg.sender_name?.toLowerCase().includes(query.toLowerCase())
          )
        : decrypted;

      // Highlight query in content
      setResults(filtered);
      setTotalFound(filtered.length);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query, channel, sender, priority, dateFrom, dateTo, token]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearFilters = () => {
    setQuery(''); setChannel(''); setSender('');
    setPriority(''); setDateFrom(''); setDateTo('');
    setResults([]); setSearched(false);
  };

  const highlightText = (text, q) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="bg-yellow-400 text-black rounded px-0.5">{part}</mark>
        : part
    );
  };

  const hasActiveFilters = query || channel || sender || priority || dateFrom || dateTo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-start justify-center pt-16 px-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-2xl border border-gray-600 shadow-2xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h2 className="text-white font-bold text-lg">Smart Search</h2>
              <p className="text-gray-400 text-xs">Search across all channels · Results decrypted locally</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages, keywords, names..."
              className="flex-1 bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500 text-sm"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
            >
              <option value="">All Channels</option>
              {CHANNELS.map(c => (
                <option key={c} value={c}>#{c}</option>
              ))}
            </select>

            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
              title="From date"
            />

            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
              title="To date"
            />
          </div>

          {/* Sender filter + clear */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={sender}
              onChange={e => setSender(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter by sender name..."
              className="flex-1 bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-green-500"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-600 hover:border-gray-400 transition"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!searched ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🔒</p>
              <p className="text-gray-400 text-sm">Search across all encrypted messages</p>
              <p className="text-gray-600 text-xs mt-2">Messages are decrypted locally — server never sees plaintext</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-3 animate-pulse">🔍</p>
              <p className="text-gray-400 text-sm">Searching & decrypting...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🤷</p>
              <p className="text-gray-400">No messages found</p>
              <p className="text-gray-600 text-xs mt-1">Try different keywords or filters</p>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-gray-500 text-xs mb-3 px-1">
                {totalFound} result{totalFound !== 1 ? 's' : ''} found
                {query && <span> for "<span className="text-white">{query}</span>"</span>}
              </p>
              <div className="space-y-2">
                {results.map((msg, i) => (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-500 cursor-pointer transition"
                    onClick={() => {
                      onJumpToChannel && onJumpToChannel(msg.channel);
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {/* Channel */}
                      <span className="text-xs bg-gray-700 text-green-400 px-2 py-0.5 rounded font-mono">
                        #{msg.channel}
                      </span>
                      {/* Priority badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getPriorityBadge(msg.priority)}`}>
                        {msg.priority}
                      </span>
                      {/* Sender */}
                      <span className="text-white text-xs font-semibold">{msg.sender_name}</span>
                      <span className="text-gray-500 text-xs">{msg.department}</span>
                      {/* Time */}
                      <span className="text-gray-600 text-xs ml-auto">{formatDate(msg.timestamp)}</span>
                    </div>
                    {/* Message content with highlight */}
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {msg.content?.startsWith('📎 __FILE__') ? (() => {
                        try {
                          const fileData = JSON.parse(msg.content.replace('📎 __FILE__', ''));
                          const isImage = fileData.type?.startsWith('image/');
                          const isVideo = fileData.type?.startsWith('video/');
                          return (
                            <div className="mt-1">
                              {isImage && (
                                <div>
                                  <img
                                    src={`http://127.0.0.1:5000${fileData.url}`}
                                    alt={fileData.name}
                                    className="max-w-xs max-h-32 rounded-lg cursor-pointer hover:opacity-90 mb-1"
                                    onClick={(e) => { e.stopPropagation(); window.open(`http://127.0.0.1:5000${fileData.url}`); }}
                                    onError={(e) => { e.target.style.display='none'; }}
                                  />
                                  <p className="text-blue-400 text-xs">📎 {fileData.name}</p>
                                </div>
                              )}
                              {isVideo && (
                                <div>
                                  <video
                                    src={`http://127.0.0.1:5000${fileData.url}`}
                                    className="max-w-xs max-h-32 rounded-lg mb-1"
                                    controls
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <p className="text-blue-400 text-xs">📎 {fileData.name}</p>
                                </div>
                              )}
                              {!isImage && !isVideo && (
                                <a
                                  href={`http://127.0.0.1:5000${fileData.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 text-sm text-blue-400 w-fit transition"
                                >
                                  📎 {fileData.name}
                                  <span className="text-gray-500 text-xs">↗ Download</span>
                                </a>
                              )}
                            </div>
                          );
                        } catch {
                          return <span className="text-blue-400">📎 File attachment</span>;
                        }
                      })() : highlightText(msg.content || '', query)}
                    </p>
                    <p className="text-gray-600 text-xs mt-1.5">
                      Click to jump to #{msg.channel}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPanel;