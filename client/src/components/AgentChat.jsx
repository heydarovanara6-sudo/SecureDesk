import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../config';

const RobotIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="32" y1="4" x2="32" y2="12" stroke="#00A650" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="32" cy="3" r="3" fill="#00A650"/>
    <rect x="14" y="12" width="36" height="26" rx="6" fill="#1C1C21" stroke="#00A650" strokeWidth="2"/>
    <circle cx="24" cy="24" r="5" fill="#0D0D0F"/>
    <circle cx="40" cy="24" r="5" fill="#0D0D0F"/>
    <circle cx="24" cy="24" r="3" fill="#00A650"/>
    <circle cx="40" cy="24" r="3" fill="#00A650"/>
    <path d="M22 32 Q32 37 42 32" stroke="#00A650" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <rect x="18" y="40" width="28" height="16" rx="4" fill="#1C1C21" stroke="#00A650" strokeWidth="2"/>
    <circle cx="26" cy="48" r="3" fill="#00A650" opacity="0.7"/>
    <circle cx="32" cy="48" r="3" fill="#00A650" opacity="0.5"/>
    <circle cx="38" cy="48" r="3" fill="#00A650" opacity="0.3"/>
    <rect x="6" y="42" width="10" height="4" rx="2" fill="#00A650" opacity="0.6"/>
    <rect x="48" y="42" width="10" height="4" rx="2" fill="#00A650" opacity="0.6"/>
  </svg>
);

function AgentChat({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am SecureDesk AI. Ask me anything about BP operations, safety, or platform features!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!open && messages.length > 1) setUnread(p => p + 1); }, [messages.length]);
  useEffect(() => { if (open) setUnread(0); }, [open]);

  const getLocalResponse = (msg) => {
    const l = msg.toLowerCase();
    if (l.includes('emergency')) return 'For emergencies, use the Emergency Broadcast button to alert all connected personnel immediately.';
    if (l.includes('encrypt') || l.includes('secur')) return 'All messages are AES-256 encrypted client-side. The server only stores ciphertext.';
    if (l.includes('channel')) return 'BP Azerbaijan has 8 channels: general, acg-operations, shah-deniz, hr-confidential, legal, finance, executive, and it-security.';
    if (l.includes('file') || l.includes('upload')) return 'Share files by clicking the paperclip button. Files are stored securely in MinIO cloud storage.';
    if (l.includes('task')) return 'Use the Task Manager in Tools menu to create, assign, and track tasks with priority levels.';
    if (l.includes('hello') || l.includes('hi') || l.includes('salam') || l.includes('hey')) return 'Hello! How can I help you today?';
    if (l.includes('weather') || l.includes('caspian')) return 'Check Caspian Conditions in Tools menu for live weather at ACG Platform, Shah Deniz, and Baku HQ.';
    if (l.includes('search')) return 'Use the Search button or Ctrl+K to search all messages by channel, priority, sender, or date.';
    return 'I am here to help with SecureDesk features and BP Azerbaijan operations. What would you like to know?';
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          prompt: 'You are SecureDesk AI, a helpful assistant for BP Azerbaijan employees. Be concise (2-3 sentences max), professional. User: ' + userMsg
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.summary || getLocalResponse(userMsg) }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'assistant', text: getLocalResponse(userMsg) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <React.Fragment>
      <button onClick={() => setOpen(p => !p)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
        style={{ background: 'linear-gradient(135deg,#007A3D,#00A650)', boxShadow: '0 4px 24px rgba(0,166,80,0.4)', transform: open ? 'scale(0.9)' : 'scale(1)' }}>
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
        <RobotIcon size={30} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl flex flex-col overflow-hidden scale-in"
          style={{ background:'var(--surface-1)', border:'1px solid var(--border)', boxShadow:'0 16px 48px rgba(0,0,0,0.6)', maxHeight:'450px' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
            <RobotIcon size={28} />
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">SecureDesk AI</p>
              <p className="text-xs" style={{ color:'var(--bp-green)' }}>Online</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">x</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight:0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={"flex gap-2 " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && <div className="shrink-0 mt-1"><RobotIcon size={18} /></div>}
                <div className="max-w-xs px-3 py-2 text-sm leading-relaxed"
                  style={{ background: msg.role === 'user' ? 'var(--bp-green)' : 'var(--surface-3)', color:'var(--text-primary)',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1"><RobotIcon size={18} /></div>
                <div className="px-3 py-2 rounded-xl" style={{ background:'var(--surface-3)' }}>
                  <div className="flex gap-1">
                    <div className="typing-dot"></div>
                    <div className="typing-dot" style={{animationDelay:'0.15s'}}></div>
                    <div className="typing-dot" style={{animationDelay:'0.3s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          <div className="p-3" style={{ borderTop:'1px solid var(--border)' }}>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything..."
                className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none"
                style={{ background:'var(--surface-3)', border:'1px solid var(--border)', color:'var(--text-primary)' }}/>
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                className="px-3 py-2 rounded-lg text-white font-bold disabled:opacity-40"
                style={{ background:'var(--bp-green)' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

export default AgentChat;import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../config';

const RobotIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="32" y1="4" x2="32" y2="12" stroke="#00A650" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="32" cy="3" r="3" fill="#00A650"/>
    <rect x="14" y="12" width="36" height="26" rx="6" fill="#1C1C21" stroke="#00A650" strokeWidth="2"/>
    <circle cx="24" cy="24" r="5" fill="#0D0D0F"/>
    <circle cx="40" cy="24" r="5" fill="#0D0D0F"/>
    <circle cx="24" cy="24" r="3" fill="#00A650"/>
    <circle cx="40" cy="24" r="3" fill="#00A650"/>
    <path d="M22 32 Q32 37 42 32" stroke="#00A650" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <rect x="18" y="40" width="28" height="16" rx="4" fill="#1C1C21" stroke="#00A650" strokeWidth="2"/>
    <circle cx="26" cy="48" r="3" fill="#00A650" opacity="0.7"/>
    <circle cx="32" cy="48" r="3" fill="#00A650" opacity="0.5"/>
    <circle cx="38" cy="48" r="3" fill="#00A650" opacity="0.3"/>
    <rect x="6" y="42" width="10" height="4" rx="2" fill="#00A650" opacity="0.6"/>
    <rect x="48" y="42" width="10" height="4" rx="2" fill="#00A650" opacity="0.6"/>
  </svg>
);

function AgentChat({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am SecureDesk AI. Ask me anything about BP operations, safety, or platform features!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!open && messages.length > 1) setUnread(p => p + 1); }, [messages.length]);
  useEffect(() => { if (open) setUnread(0); }, [open]);

  const getLocalResponse = (msg) => {
    const l = msg.toLowerCase();
    if (l.includes('emergency')) return 'For emergencies, use the Emergency Broadcast button to alert all connected personnel immediately.';
    if (l.includes('encrypt') || l.includes('secur')) return 'All messages are AES-256 encrypted client-side. The server only stores ciphertext.';
    if (l.includes('channel')) return 'BP Azerbaijan has 8 channels: general, acg-operations, shah-deniz, hr-confidential, legal, finance, executive, and it-security.';
    if (l.includes('file') || l.includes('upload')) return 'Share files by clicking the paperclip button. Files are stored securely in MinIO cloud storage.';
    if (l.includes('task')) return 'Use the Task Manager in Tools menu to create, assign, and track tasks with priority levels.';
    if (l.includes('hello') || l.includes('hi') || l.includes('salam') || l.includes('hey')) return 'Hello! How can I help you today?';
    if (l.includes('weather') || l.includes('caspian')) return 'Check Caspian Conditions in Tools menu for live weather at ACG Platform, Shah Deniz, and Baku HQ.';
    if (l.includes('search')) return 'Use the Search button or Ctrl+K to search all messages by channel, priority, sender, or date.';
    return 'I am here to help with SecureDesk features and BP Azerbaijan operations. What would you like to know?';
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          prompt: 'You are SecureDesk AI, a helpful assistant for BP Azerbaijan employees. Be concise (2-3 sentences max), professional. User: ' + userMsg
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.summary || getLocalResponse(userMsg) }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'assistant', text: getLocalResponse(userMsg) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <React.Fragment>
      <button onClick={() => setOpen(p => !p)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
        style={{ background: 'linear-gradient(135deg,#007A3D,#00A650)', boxShadow: '0 4px 24px rgba(0,166,80,0.4)', transform: open ? 'scale(0.9)' : 'scale(1)' }}>
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
        <RobotIcon size={30} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl flex flex-col overflow-hidden scale-in"
          style={{ background:'var(--surface-1)', border:'1px solid var(--border)', boxShadow:'0 16px 48px rgba(0,0,0,0.6)', maxHeight:'450px' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
            <RobotIcon size={28} />
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">SecureDesk AI</p>
              <p className="text-xs" style={{ color:'var(--bp-green)' }}>Online</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">x</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight:0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={"flex gap-2 " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && <div className="shrink-0 mt-1"><RobotIcon size={18} /></div>}
                <div className="max-w-xs px-3 py-2 text-sm leading-relaxed"
                  style={{ background: msg.role === 'user' ? 'var(--bp-green)' : 'var(--surface-3)', color:'var(--text-primary)',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1"><RobotIcon size={18} /></div>
                <div className="px-3 py-2 rounded-xl" style={{ background:'var(--surface-3)' }}>
                  <div className="flex gap-1">
                    <div className="typing-dot"></div>
                    <div className="typing-dot" style={{animationDelay:'0.15s'}}></div>
                    <div className="typing-dot" style={{animationDelay:'0.3s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          <div className="p-3" style={{ borderTop:'1px solid var(--border)' }}>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything..."
                className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none"
                style={{ background:'var(--surface-3)', border:'1px solid var(--border)', color:'var(--text-primary)' }}/>
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                className="px-3 py-2 rounded-lg text-white font-bold disabled:opacity-40"
                style={{ background:'var(--bp-green)' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

export default AgentChat;