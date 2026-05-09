import React, { useState, useEffect } from 'react';

function MusterRoll({ socket, user, onClose, activeMuster }) {
  const [rollCall, setRollCall] = useState(activeMuster || null);
  const [myStatus, setMyStatus] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('muster_started', (data) => {
      setRollCall(data);
      setMyStatus(null);
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==');
      audio.play().catch(() => {});
    });

    socket.on('muster_updated', (data) => setRollCall(data));
    socket.on('muster_ended', () => { setRollCall(null); setMyStatus(null); });

    return () => {
      socket.off('muster_started');
      socket.off('muster_updated');
      socket.off('muster_ended');
    };
  }, [socket]);

  const startRollCall = () => { if (socket) socket.emit('start_muster', {}); };
  const checkin = (status) => {
    if (socket) { socket.emit('muster_checkin', { status }); setMyStatus(status); }
  };
  const endRollCall = () => { if (socket) socket.emit('end_muster', {}); };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const responded = rollCall ? (rollCall.safe.length + rollCall.injured.length) : 0;
  const total = rollCall ? rollCall.total : 0;
  const notResponded = rollCall ? rollCall.not_responded : [];
  const pct = total > 0 ? Math.round((responded / total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-85 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-lg border-2 border-orange-500 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧑‍🤝‍🧑</span>
            <div>
              <h2 className="text-white font-bold text-lg">Emergency Muster Roll Call</h2>
              <p className="text-orange-400 text-xs">BP Azerbaijan Personnel Accountability</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5">
          {!rollCall ? (
            <div className="text-center py-6">
              <p className="text-5xl mb-4">🛡️</p>
              <p className="text-white font-semibold mb-1">No active roll call</p>
              <p className="text-gray-400 text-sm mb-6">In an emergency, start a roll call to account for all online personnel instantly.</p>
              {isAdmin ? (
                <button onClick={startRollCall} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-lg text-lg transition">
                  🚨 Start Emergency Roll Call
                </button>
              ) : (
                <p className="text-gray-500 text-sm">Waiting for admin to start a roll call...</p>
              )}
            </div>
          ) : (
            <div>
              <div className="bg-orange-900 bg-opacity-30 border border-orange-600 rounded-lg px-4 py-2 mb-4 text-sm text-orange-300">
                🚨 Roll call started by <strong>{rollCall.initiated_by}</strong> — {new Date(rollCall.started_at).toLocaleTimeString()}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Responded: <span className="text-white font-bold">{responded}</span> / {total}</span>
                  <span className="text-white font-bold">{pct}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div className={`h-4 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-green-900 bg-opacity-30 rounded-lg p-3 border border-green-700">
                  <p className="text-green-400 font-bold text-xs mb-2 flex items-center gap-1">✅ SAFE <span className="ml-auto bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{rollCall.safe.length}</span></p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {rollCall.safe.map((n, i) => <p key={i} className="text-green-300 text-xs truncate">{n}</p>)}
                  </div>
                </div>
                <div className="bg-yellow-900 bg-opacity-30 rounded-lg p-3 border border-yellow-700">
                  <p className="text-yellow-400 font-bold text-xs mb-2 flex items-center gap-1">⚠️ INJURED <span className="ml-auto bg-yellow-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{rollCall.injured.length}</span></p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {rollCall.injured.map((n, i) => <p key={i} className="text-yellow-300 text-xs truncate">{n}</p>)}
                  </div>
                </div>
                <div className="bg-red-900 bg-opacity-30 rounded-lg p-3 border border-red-700">
                  <p className="text-red-400 font-bold text-xs mb-2 flex items-center gap-1">❌ NO RESP. <span className="ml-auto bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{notResponded.length}</span></p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {notResponded.map((n, i) => <p key={i} className="text-red-300 text-xs truncate">{n}</p>)}
                  </div>
                </div>
              </div>

              {!myStatus ? (
                <div className="mb-4">
                  <p className="text-white text-sm font-semibold mb-2 text-center">Report your status:</p>
                  <div className="flex gap-3">
                    <button onClick={() => checkin('safe')} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-lg transition">✅ I AM SAFE</button>
                    <button onClick={() => checkin('injured')} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 rounded-lg text-lg transition">⚠️ INJURED</button>
                  </div>
                </div>
              ) : (
                <div className={`text-center py-4 mb-4 rounded-lg border ${myStatus === 'safe' ? 'bg-green-900 bg-opacity-30 border-green-600' : 'bg-yellow-900 bg-opacity-30 border-yellow-600'}`}>
                  <p className={`font-bold text-lg ${myStatus === 'safe' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {myStatus === 'safe' ? '✅ You reported: SAFE' : '⚠️ You reported: INJURED'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">Your response has been recorded</p>
                </div>
              )}

              {isAdmin && (
                <button onClick={endRollCall} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition">
                  End Roll Call
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MusterRoll;