import API_BASE from '../config';
import React, { useState } from 'react';

const SUMMARY_MODES = [
  { id: 'brief',  label: '⚡ Quick Briefing', desc: '3-5 bullet points of key info' },
  { id: 'action', label: '✅ Action Items',    desc: 'What needs to be done & by whom' },
  { id: 'risk',   label: '⚠️ Risk & Safety',  desc: 'Safety issues, alerts, concerns' },
  { id: 'full',   label: '📋 Full Summary',   desc: 'Detailed overview of all topics' },
];

// ─── Local fallback summarizer (works offline / no API key) ──────────
const RISK_WORDS = ['emergency','danger','hazard','incident','fire','leak','explosion',
  'injury','injured','evacuate','shutdown','critical','warning','alert','sos',
  'spill','gas','pressure','failure','malfunction','mayday','storm','damage','unsafe'];
const ACTION_WORDS = ['need','must','should','please','asap','immediately','required',
  'deadline','action','todo','task','confirm','report','check','review','send',
  'fix','repair','inspect','notify','escalate','follow up','follow-up'];

const localSummarize = (msgs, mode, channel) => {
  const valid = msgs.filter(m => m.content && !m.content.startsWith('📎 __FILE__'));
  if (!valid.length) return 'No text messages found in this channel.';

  const urgent = valid.filter(m => m.priority === 'urgent');
  const important = valid.filter(m => m.priority === 'important');
  const senders = [...new Set(valid.map(m => m.sender_name))];
  const riskMsgs = valid.filter(m =>
    RISK_WORDS.some(w => m.content.toLowerCase().includes(w)));
  const actionMsgs = valid.filter(m =>
    ACTION_WORDS.some(w => m.content.toLowerCase().includes(w)));
  const files = msgs.filter(m => m.content?.startsWith('📎 __FILE__'));

  const fmt = (m) => `• ${m.sender_name}: "${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}"`;

  if (mode === 'brief') {
    const lines = [
      `📊 Channel #${channel} — ${valid.length} messages from ${senders.length} participant(s)`,
      `👥 Active participants: ${senders.join(', ')}`,
    ];
    if (urgent.length) lines.push(`🔴 ${urgent.length} URGENT message(s) flagged`);
    if (important.length) lines.push(`🟡 ${important.length} IMPORTANT message(s) flagged`);
    if (files.length) lines.push(`📎 ${files.length} file(s) shared`);
    if (riskMsgs.length) lines.push(`⚠️ ${riskMsgs.length} message(s) contain risk-related keywords`);
    lines.push(`\n💬 Recent activity:\n${valid.slice(-3).map(fmt).join('\n')}`);
    return lines.join('\n');
  }

  if (mode === 'action') {
    if (!actionMsgs.length) return `✅ No clear action items detected in #${channel}.\n\nAll ${valid.length} messages reviewed — no tasks, deadlines, or requests found.`;
    return `✅ ACTION ITEMS DETECTED in #${channel}\n\n${actionMsgs.map(fmt).join('\n')}\n\n📌 ${actionMsgs.length} message(s) may contain tasks or requests. Review and assign accordingly.`;
  }

  if (mode === 'risk') {
    if (!riskMsgs.length && !urgent.length) {
      return `✅ NO RISKS IDENTIFIED in #${channel}\n\nAll ${valid.length} messages reviewed — no safety concerns, hazards, or incidents detected.`;
    }
    const lines = [`⚠️ RISK SUMMARY for #${channel}\n`];
    if (urgent.length) {
      lines.push(`🔴 URGENT MESSAGES (${urgent.length}):`);
      urgent.forEach(m => lines.push(fmt(m)));
    }
    if (riskMsgs.length) {
      lines.push(`\n⚠️ RISK KEYWORDS DETECTED (${riskMsgs.length}):`);
      riskMsgs.forEach(m => lines.push(fmt(m)));
    }
    lines.push(`\n🛢️ Notify OIM / supervisor if any safety issue requires immediate action.`);
    return lines.join('\n');
  }

  if (mode === 'full') {
    const lines = [
      `📋 FULL SUMMARY — #${channel}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 Total messages: ${valid.length} | Participants: ${senders.length}`,
      `👥 Participants: ${senders.join(', ')}`,
      '',
      `📈 Priority breakdown:`,
      `  🔴 Urgent: ${urgent.length}`,
      `  🟡 Important: ${important.length}`,
      `  ⚫ Confidential: ${valid.filter(m => m.priority === 'confidential').length}`,
      `  🔵 Normal: ${valid.filter(m => m.priority === 'normal').length}`,
      `  📎 Files shared: ${files.length}`,
      '',
    ];
    if (riskMsgs.length) {
      lines.push(`⚠️ Risk-related messages (${riskMsgs.length}):`);
      riskMsgs.slice(0, 3).forEach(m => lines.push(fmt(m)));
      lines.push('');
    }
    if (actionMsgs.length) {
      lines.push(`✅ Potential action items (${actionMsgs.length}):`);
      actionMsgs.slice(0, 3).forEach(m => lines.push(fmt(m)));
      lines.push('');
    }
    lines.push(`💬 Recent messages:`);
    valid.slice(-5).forEach(m => lines.push(fmt(m)));
    return lines.join('\n');
  }

  return 'Summary not available.';
};

// ─── Component ───────────────────────────────────────────────────────
function AISummary({ messages, channelName, onClose }) {
  const [mode, setMode] = useState('brief');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msgCount, setMsgCount] = useState(50);
  const [usedAI, setUsedAI] = useState(false);

  const buildPrompt = (msgs, selectedMode) => {
    const ctxMap = {
      'general': 'general company communication',
      'acg-operations': 'ACG offshore oil platform operations (safety-critical)',
      'shah-deniz': 'Shah Deniz gas pipeline operations',
      'hr-confidential': 'HR and personnel matters',
      'legal': 'legal and compliance matters',
      'finance': 'financial decisions and reporting',
      'executive': 'senior management decisions',
      'it-security': 'IT infrastructure and cybersecurity',
    };
    const ctx = ctxMap[channelName] || 'internal BP communication';
    const formatted = msgs
      .filter(m => m.content && !m.content.startsWith('📎 __FILE__'))
      .slice(-msgCount)
      .map(m => `[${(m.priority || 'normal').toUpperCase()}] ${m.sender_name} (${m.department || 'BP'}): ${m.content}`)
      .join('\n');

    const modeInstr = {
      brief: 'Provide a concise briefing in 3-5 bullet points covering the main topics discussed.',
      action: 'Extract all action items, tasks, and decisions. Format as "• [Person]: [Action]".',
      risk: 'Identify safety concerns, risks, incidents, urgent issues. If none, state "No risks identified."',
      full: 'Comprehensive summary: 1) Main topics, 2) Key decisions, 3) Action items, 4) Risks.',
    };

    return `You are an AI assistant for SecureDesk, BP Azerbaijan's encrypted messenger.
Analyze these ${msgs.length} messages from #${channelName} (${ctx}).
${modeInstr[selectedMode]}
Be professional and concise. Focus on oil & gas operational context.

MESSAGES:
${formatted}`;
  };

  const handleSummarize = async () => {
    if (!messages || messages.length === 0) {
      setError('No messages to summarize.');
      return;
    }
    setLoading(true);
    setError('');
    setSummary('');
    setUsedAI(false);

    const token = localStorage.getItem('token');

    try {
      // Try Flask proxy (works when ANTHROPIC_API_KEY is set on server)
      const res = await fetch(`${API_BASE}/api/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: buildPrompt(messages.slice(-msgCount), mode) })
      });

      const data = await res.json();

      if (res.ok && data.summary) {
        setSummary(data.summary);
        setUsedAI(true);
        return;
      }
      // Fall through to local if API key not set
      throw new Error(data.error || 'No summary returned');
    } catch (err) {
      // Fallback: local summarization (always works, no API needed)
      const local = localSummarize(messages.slice(-msgCount), mode, channelName);
      setSummary(local);
      setUsedAI(false);
    } finally {
      setLoading(false);
    }
  };

  const validMessages = messages?.filter(m => m.content && !m.content.startsWith('📎 __FILE__')) || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-lg border border-purple-500 shadow-2xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-white font-bold text-lg">AI Channel Summary</h2>
              <p className="text-purple-400 text-xs">
                #{channelName} · {validMessages.length} messages · Claude AI + local fallback
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Mode selection */}
          <div className="mb-4">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Summary Type</p>
            <div className="grid grid-cols-2 gap-2">
              {SUMMARY_MODES.map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); setSummary(''); }}
                  className={`text-left p-3 rounded-lg border transition ${
                    mode === m.id
                      ? 'bg-purple-900 bg-opacity-40 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message count slider */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <p className="text-gray-400 text-xs uppercase font-semibold">Messages to analyze</p>
              <p className="text-white text-xs font-bold">Last {Math.min(msgCount, validMessages.length)}</p>
            </div>
            <input type="range" min={10} max={Math.min(100, Math.max(validMessages.length, 10))} step={10}
              value={msgCount} onChange={e => { setMsgCount(Number(e.target.value)); setSummary(''); }}
              className="w-full accent-purple-500" />
          </div>

          {/* Info notice */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mb-4">
            <p className="text-gray-400 text-xs">
              🔒 Messages decrypted locally. When deployed with <code className="text-purple-400">ANTHROPIC_API_KEY</code>, uses Claude AI. Otherwise uses built-in smart analysis.
            </p>
          </div>

          {/* Button */}
          <button onClick={handleSummarize} disabled={loading || validMessages.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 mb-4">
            {loading
              ? <><span className="animate-spin">⚙️</span> Analyzing...</>
              : <>🤖 Generate Summary</>}
          </button>

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Summary output */}
          {summary && (
            <div className="bg-gray-800 border border-purple-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-purple-400 text-xs font-semibold uppercase flex items-center gap-2">
                  {SUMMARY_MODES.find(m => m.id === mode)?.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${usedAI ? 'bg-purple-700 text-purple-200' : 'bg-gray-700 text-gray-300'}`}>
                    {usedAI ? '✨ Claude AI' : '🧠 Smart Analysis'}
                  </span>
                </p>
                <button onClick={() => navigator.clipboard.writeText(summary)}
                  className="text-gray-500 hover:text-white text-xs transition">
                  📋 Copy
                </button>
              </div>
              <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {summary}
              </div>
              <p className="text-gray-600 text-xs mt-3 border-t border-gray-700 pt-2">
                {new Date().toLocaleTimeString()} · #{channelName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AISummary;
