import React, { useState, useEffect } from 'react';

const DEFAULTS = {
  enabled: true,
  sound: true,
  urgentSound: true,
  importantSound: false,
  normalSound: false,
  mentionSound: true,
  dmSound: true,
  muteAll: false,
  mutedChannels: [],
  quietHoursEnabled: false,
  quietFrom: '22:00',
  quietTo: '07:00',
  showBadge: true,
  desktopNotif: false,
  urgentDesktop: true,
  importantDesktop: false,
  normalDesktop: false,
  focusMode: false,          // only urgent + DMs
  urgentPopup: true,
};

const STORAGE_KEY = 'securedesk_notif_settings';

export const loadNotifSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
};

export const saveNotifSettings = (settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const CHANNELS = [
  'general','acg-operations','shah-deniz',
  'hr-confidential','legal','finance','executive','it-security'
];

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' :
        value ? 'bg-green-500' : 'bg-gray-600'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Row({ label, sub, value, onChange, disabled, indent }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${indent ? 'pl-5 border-l-2 border-gray-700 ml-2' : ''}`}>
      <div>
        <p className={`text-sm ${disabled ? 'text-gray-500' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function NotificationSettings({ onClose, onSettingsChange }) {
  const [s, setS] = useState(loadNotifSettings);

  const update = (key, val) => {
    const next = { ...s, [key]: val };
    setS(next);
    saveNotifSettings(next);
    onSettingsChange && onSettingsChange(next);
  };

  const toggleMutedChannel = (ch) => {
    const muted = s.mutedChannels.includes(ch)
      ? s.mutedChannels.filter(c => c !== ch)
      : [...s.mutedChannels, ch];
    update('mutedChannels', muted);
  };

  const isInQuietHours = () => {
    if (!s.quietHoursEnabled) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = s.quietFrom.split(':').map(Number);
    const [th, tm] = s.quietTo.split(':').map(Number);
    const from = fh * 60 + fm;
    const to = th * 60 + tm;
    return from > to ? (cur >= from || cur <= to) : (cur >= from && cur <= to);
  };

  const quietNow = isInQuietHours();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md border border-gray-600 shadow-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔕</span>
            <div>
              <h2 className="text-white font-bold text-lg">Notification Settings</h2>
              <p className="text-gray-400 text-xs">Smart filtering — only get notified what matters</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Quick modes */}
          <div>
            <p className="text-gray-400 text-xs uppercase font-semibold mb-3">Quick Modes</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { update('focusMode', false); update('muteAll', false); }}
                className={`py-3 rounded-lg border text-sm font-semibold transition ${
                  !s.focusMode && !s.muteAll
                    ? 'bg-green-700 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                }`}
              >
                🔔 All Notifications
              </button>
              <button
                onClick={() => { update('focusMode', true); update('muteAll', false); }}
                className={`py-3 rounded-lg border text-sm font-semibold transition ${
                  s.focusMode && !s.muteAll
                    ? 'bg-yellow-700 border-yellow-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                }`}
              >
                🎯 Focus Mode
                <p className="text-xs font-normal opacity-70">Urgent + DMs only</p>
              </button>
              <button
                onClick={() => update('muteAll', !s.muteAll)}
                className={`py-3 rounded-lg border text-sm font-semibold transition col-span-2 ${
                  s.muteAll
                    ? 'bg-red-900 border-red-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                }`}
              >
                🔕 Mute All {s.muteAll ? '(Active)' : ''}
              </button>
            </div>
            {s.focusMode && (
              <p className="text-yellow-400 text-xs mt-2 bg-yellow-900 bg-opacity-20 rounded px-3 py-1.5">
                🎯 Focus Mode: only 🔴 Urgent messages and 💬 Direct Messages will notify you
              </p>
            )}
            {quietNow && (
              <p className="text-blue-400 text-xs mt-2 bg-blue-900 bg-opacity-20 rounded px-3 py-1.5">
                🌙 Quiet Hours active — notifications suppressed until {s.quietTo}
              </p>
            )}
          </div>

          {/* Sound settings */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Sound Alerts</p>
            <div className="divide-y divide-gray-800">
              <Row label="Enable sounds" value={s.sound} onChange={v => update('sound', v)} disabled={s.muteAll} />
              <Row label="🔴 Urgent messages" sub="Play alert sound for urgent" indent value={s.urgentSound} onChange={v => update('urgentSound', v)} disabled={s.muteAll || !s.sound} />
              <Row label="🟡 Important messages" indent value={s.importantSound} onChange={v => update('importantSound', v)} disabled={s.muteAll || !s.sound || s.focusMode} />
              <Row label="🔵 Normal messages" indent value={s.normalSound} onChange={v => update('normalSound', v)} disabled={s.muteAll || !s.sound || s.focusMode} />
              <Row label="💬 Direct Messages" indent value={s.dmSound} onChange={v => update('dmSound', v)} disabled={s.muteAll || !s.sound} />
            </div>
          </div>

          {/* Quiet hours */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Quiet Hours</p>
            <Row
              label="🌙 Enable Quiet Hours"
              sub="Suppress sounds during off hours"
              value={s.quietHoursEnabled}
              onChange={v => update('quietHoursEnabled', v)}
              disabled={s.muteAll}
            />
            {s.quietHoursEnabled && (
              <div className="flex gap-3 mt-2 pl-2">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">From</p>
                  <input
                    type="time"
                    value={s.quietFrom}
                    onChange={e => update('quietFrom', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">To</p>
                  <input
                    type="time"
                    value={s.quietTo}
                    onChange={e => update('quietTo', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Muted channels */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Muted Channels</p>
            <p className="text-gray-500 text-xs mb-3">Messages still arrive but make no sound</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CHANNELS.map(ch => (
                <button
                  key={ch}
                  onClick={() => toggleMutedChannel(ch)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition border ${
                    s.mutedChannels.includes(ch)
                      ? 'bg-gray-700 border-gray-500 text-gray-300 line-through'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {s.mutedChannels.includes(ch) ? '🔕' : '🔔'} #{ch}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => {
              const reset = { ...DEFAULTS };
              setS(reset);
              saveNotifSettings(reset);
              onSettingsChange && onSettingsChange(reset);
            }}
            className="w-full text-gray-400 hover:text-white text-xs py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;