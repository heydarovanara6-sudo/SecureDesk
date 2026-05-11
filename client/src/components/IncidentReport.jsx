import API_BASE from '../config';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const INCIDENT_TYPES = [
  'Fire / Explosion', 'Gas Leak', 'Oil Spill', 'Equipment Failure',
  'Electrical Fault', 'Structural Damage', 'Medical Emergency',
  'Near Miss', 'Environmental', 'Security Breach', 'Other'
];

const PLATFORMS = [
  'ACG Platform (Chirag)', 'ACG Platform (Deepwater Gunashli)',
  'ACG Platform (Azeri)', 'Shah Deniz Platform',
  'Baku HQ - 153 Neftchilar', 'Sangachal Terminal', 'Other'
];

const SEVERITY = [
  { value: 'low',      label: '🟢 Low',      desc: 'Minor, no injuries, contained' },
  { value: 'medium',   label: '🟡 Medium',    desc: 'Moderate impact, monitor closely' },
  { value: 'high',     label: '🟠 High',      desc: 'Significant risk, escalate now' },
  { value: 'critical', label: '🔴 Critical',  desc: 'Life-threatening, evacuate if needed' },
];

const SEVERITY_STYLE = {
  low:      'border-green-600 bg-green-900 bg-opacity-20',
  medium:   'border-yellow-600 bg-yellow-900 bg-opacity-20',
  high:     'border-orange-600 bg-orange-900 bg-opacity-20',
  critical: 'border-red-600 bg-red-900 bg-opacity-30',
};

const STATUS_STYLE = {
  open:          'bg-red-900 text-red-300',
  investigating: 'bg-yellow-900 text-yellow-300',
  resolved:      'bg-green-900 text-green-300',
  closed:        'bg-gray-700 text-gray-400',
};

const fmtTime = (ts) => {
  try { return new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return ts; }
};

function IncidentReport({ user, onClose }) {
  const [view, setView]           = useState('list'); // list | new
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);

  const [form, setForm] = useState({
    title: '', type: '', severity: 'medium', platform: '',
    location: '', description: '', injuries: 'none',
    injuries_desc: '', actions_taken: '', follow_up: '', witnesses: ''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/incidents`, { headers });
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchIncidents(); }, []);

  const submitIncident = async () => {
    if (!form.title || !form.type || !form.platform || !form.description) {
      alert('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/incidents`, form, { headers });
      setSuccess(true);
      fetchIncidents();
      setTimeout(() => { setSuccess(false); setView('list'); setForm({
        title:'', type:'', severity:'medium', platform:'',
        location:'', description:'', injuries:'none',
        injuries_desc:'', actions_taken:'', follow_up:'', witnesses:''
      }); }, 2000);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_BASE}/api/incidents/${id}/status`, { status }, { headers });
      setIncidents(prev => prev.map(i => i._id === id ? { ...i, status } : i));
      if (selected?._id === id) setSelected(prev => ({ ...prev, status }));
    } catch (e) { console.error(e); }
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-85 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl border border-orange-600 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-white font-bold text-lg">Incident Report</h2>
              <p className="text-orange-400 text-xs">BP Azerbaijan · Safety Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('list')}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-semibold ${view==='list' ? 'bg-orange-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              📋 All Reports ({incidents.length})
            </button>
            <button onClick={() => setView('new')}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-semibold ${view==='new' ? 'bg-orange-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              ➕ New Report
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl ml-2">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* NEW INCIDENT FORM */}
          {view === 'new' && (
            <div className="p-5 space-y-4">
              {success && (
                <div className="bg-green-900 border border-green-500 rounded-lg px-4 py-3 text-center">
                  <p className="text-green-400 font-bold">✅ Incident report submitted and logged to audit trail</p>
                </div>
              )}

              {/* Severity selector */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-2">Severity Level *</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEVERITY.map(s => (
                    <button key={s.value} onClick={() => f('severity', s.value)}
                      className={`text-left p-3 rounded-lg border-2 transition ${form.severity === s.value ? SEVERITY_STYLE[s.value] : 'border-gray-700 bg-gray-800'}`}>
                      <p className="text-white text-sm font-bold">{s.label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Incident Title *</p>
                <input value={form.title} onChange={e => f('title', e.target.value)}
                  placeholder="Brief description of the incident"
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
              </div>

              {/* Type + Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Incident Type *</p>
                  <select value={form.type} onChange={e => f('type', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    <option value="">Select type...</option>
                    {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Platform / Location *</p>
                  <select value={form.platform} onChange={e => f('platform', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    <option value="">Select platform...</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Exact location */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Exact Location / Area</p>
                <input value={form.location} onChange={e => f('location', e.target.value)}
                  placeholder="e.g. Deck 3, Module C, Compressor Room"
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
              </div>

              {/* Description */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Incident Description *</p>
                <textarea value={form.description} onChange={e => f('description', e.target.value)}
                  placeholder="Describe what happened, when, and how. Include all relevant details."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              {/* Injuries */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Injuries / Casualties</p>
                <div className="flex gap-2 mb-2">
                  {['none','minor','serious','fatality'].map(v => (
                    <button key={v} onClick={() => f('injuries', v)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition border ${form.injuries === v
                        ? v === 'none' ? 'bg-green-800 border-green-500 text-white'
                          : v === 'minor' ? 'bg-yellow-800 border-yellow-500 text-white'
                          : v === 'serious' ? 'bg-orange-800 border-orange-500 text-white'
                          : 'bg-red-800 border-red-500 text-white'
                        : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                      {v === 'none' ? '✅ None' : v === 'minor' ? '🟡 Minor' : v === 'serious' ? '🟠 Serious' : '🔴 Fatality'}
                    </button>
                  ))}
                </div>
                {form.injuries !== 'none' && (
                  <input value={form.injuries_desc} onChange={e => f('injuries_desc', e.target.value)}
                    placeholder="Describe injuries and persons involved"
                    className="w-full bg-gray-800 border border-orange-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                )}
              </div>

              {/* Actions taken */}
              <div>
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Immediate Actions Taken</p>
                <textarea value={form.actions_taken} onChange={e => f('actions_taken', e.target.value)}
                  placeholder="What was done immediately after the incident?"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              {/* Follow-up + Witnesses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Follow-up Required</p>
                  <textarea value={form.follow_up} onChange={e => f('follow_up', e.target.value)}
                    placeholder="Required next steps..."
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Witnesses</p>
                  <textarea value={form.witnesses} onChange={e => f('witnesses', e.target.value)}
                    placeholder="Names of witnesses..."
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none" />
                </div>
              </div>

              {/* Reporter info */}
              <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400 border border-gray-700">
                📝 Reporting as: <span className="text-white font-semibold">{user?.name}</span> · {user?.department} · {new Date().toLocaleString('en-GB')}
              </div>

              {/* Submit */}
              {form.severity === 'critical' && (
                <div className="bg-red-900 bg-opacity-40 border border-red-500 rounded-lg px-4 py-3 animate-pulse">
                  <p className="text-red-400 font-bold text-sm">🚨 CRITICAL INCIDENT — Also trigger Emergency Broadcast and notify OIM immediately</p>
                </div>
              )}

              <button onClick={submitIncident} disabled={submitting}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition text-sm">
                {submitting ? '⏳ Submitting...' : '📋 Submit Incident Report'}
              </button>
            </div>
          )}

          {/* INCIDENT LIST */}
          {view === 'list' && (
            <div className="flex h-full">
              {/* List */}
              <div className="flex-1 p-4 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-12 text-gray-400">Loading incidents...</div>
                ) : incidents.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">✅</p>
                    <p className="text-gray-400">No incidents reported</p>
                    <p className="text-gray-600 text-xs mt-1">BP Azerbaijan operations running normally</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incidents.map(inc => (
                      <div key={inc._id} onClick={() => setSelected(inc)}
                        className={`rounded-lg p-3 border cursor-pointer hover:border-gray-500 transition ${SEVERITY_STYLE[inc.severity]} ${selected?._id === inc._id ? 'ring-1 ring-orange-500' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[inc.status]}`}>
                                {inc.status}
                              </span>
                              <span className="text-xs text-gray-400">{inc.type}</span>
                            </div>
                            <p className="text-white text-sm font-semibold">{inc.title}</p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              📍 {inc.platform} · 👤 {inc.reported_by} · 🕐 {fmtTime(inc.reported_at)}
                            </p>
                          </div>
                          <span className="text-lg shrink-0">
                            {inc.severity === 'critical' ? '🔴' : inc.severity === 'high' ? '🟠' : inc.severity === 'medium' ? '🟡' : '🟢'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selected && (
                <div className="w-72 border-l border-gray-700 p-4 overflow-y-auto">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-white font-bold text-sm leading-snug flex-1">{selected.title}</p>
                    <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white ml-2">✕</button>
                  </div>

                  <div className="space-y-2 text-xs mb-4">
                    <div className="flex justify-between"><span className="text-gray-500">Severity</span>
                      <span>{selected.severity === 'critical' ? '🔴 Critical' : selected.severity === 'high' ? '🟠 High' : selected.severity === 'medium' ? '🟡 Medium' : '🟢 Low'}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-white">{selected.type}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Platform</span><span className="text-white text-right max-w-32">{selected.platform}</span></div>
                    {selected.location && <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="text-white">{selected.location}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Reporter</span><span className="text-white">{selected.reported_by}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="text-white">{fmtTime(selected.reported_at)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Injuries</span>
                      <span className={selected.injuries !== 'none' ? 'text-red-400 font-bold' : 'text-green-400'}>{selected.injuries}</span>
                    </div>
                  </div>

                  {selected.description && <div className="mb-3"><p className="text-gray-500 text-xs mb-1">Description</p><p className="text-gray-300 text-xs leading-relaxed">{selected.description}</p></div>}
                  {selected.actions_taken && <div className="mb-3"><p className="text-gray-500 text-xs mb-1">Actions Taken</p><p className="text-gray-300 text-xs">{selected.actions_taken}</p></div>}
                  {selected.follow_up && <div className="mb-3"><p className="text-gray-500 text-xs mb-1">Follow-up</p><p className="text-gray-300 text-xs">{selected.follow_up}</p></div>}
                  {selected.witnesses && <div className="mb-4"><p className="text-gray-500 text-xs mb-1">Witnesses</p><p className="text-gray-300 text-xs">{selected.witnesses}</p></div>}

                  {isAdmin && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1.5">Update Status</p>
                      <div className="grid grid-cols-2 gap-1">
                        {['open','investigating','resolved','closed'].map(s => (
                          <button key={s} onClick={() => updateStatus(selected._id, s)}
                            className={`text-xs py-1.5 rounded transition ${selected.status === s ? STATUS_STYLE[s]+' font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IncidentReport;
