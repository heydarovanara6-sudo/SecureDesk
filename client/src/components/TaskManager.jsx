import API_BASE from '../config';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PRIORITIES = ['low','normal','high','critical'];
const STATUSES   = ['open','in-progress','done','blocked'];

const PRIORITY_STYLE = {
  critical: 'bg-red-500 text-white',
  high:     'bg-orange-500 text-white',
  normal:   'bg-blue-500 text-white',
  low:      'bg-gray-500 text-white',
};
const STATUS_STYLE = {
  open:        'bg-gray-700 text-gray-300',
  'in-progress':'bg-yellow-700 text-yellow-200',
  done:        'bg-green-700 text-green-200',
  blocked:     'bg-red-900 text-red-300',
};
const STATUS_ICON = { open:'📋', 'in-progress':'⚙️', done:'✅', blocked:'🚫' };

const CHANNELS = ['general','acg-operations','shah-deniz','hr-confidential','legal','finance','executive','it-security'];

function TaskManager({ user, onClose }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('board'); // board | list | mine
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [comment, setComment]     = useState('');
  const [form, setForm] = useState({
    title:'', description:'', assigned_to:'', assigned_email:'',
    priority:'normal', channel:'general', due_date:''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/tasks`, { headers });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const createTask = async () => {
    if (!form.title.trim()) return;
    try {
      await axios.post(`${API_BASE}/api/tasks`, form, { headers });
      setShowCreate(false);
      setForm({ title:'', description:'', assigned_to:'', assigned_email:'', priority:'normal', channel:'general', due_date:'' });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_BASE}/api/tasks/${id}`, { status }, { headers });
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
      if (selected?._id === id) setSelected(prev => ({ ...prev, status }));
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API_BASE}/api/tasks/${id}`, { headers });
      setTasks(prev => prev.filter(t => t._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (e) { console.error(e); }
  };

  const addComment = async () => {
    if (!comment.trim() || !selected) return;
    try {
      await axios.post(`${API_BASE}/api/tasks/${selected._id}/comment`, { text: comment }, { headers });
      const newComment = { text: comment, author: user.name, time: new Date().toISOString() };
      setSelected(prev => ({ ...prev, comments: [...(prev.comments||[]), newComment] }));
      setTasks(prev => prev.map(t => t._id === selected._id
        ? { ...t, comments: [...(t.comments||[]), newComment] }
        : t));
      setComment('');
    } catch (e) { console.error(e); }
  };

  const filtered = tasks.filter(t =>
    (!filterStatus  || t.status  === filterStatus) &&
    (!filterChannel || t.channel === filterChannel)
  );
  const mine = tasks.filter(t => t.assigned_email === user?.email || t.created_by_email === user?.email);
  const displayed = view === 'mine' ? mine : filtered;

  const byStatus = (s) => displayed.filter(t => t.status === s);
  const overdue  = (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d; } };

  const TaskCard = ({ task }) => (
    <div
      onClick={() => setSelected(task)}
      className={`bg-gray-800 rounded-lg p-3 mb-2 border cursor-pointer hover:border-gray-500 transition ${
        overdue(task) ? 'border-red-700' : 'border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-white text-sm font-semibold leading-snug">{task.title}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-green-400 font-mono">#{task.channel}</span>
        {task.assigned_to && <span className="text-xs text-gray-400">👤 {task.assigned_to}</span>}
        {task.due_date && (
          <span className={`text-xs ${overdue(task) ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
            📅 {fmtDate(task.due_date)}{overdue(task) ? ' ⚠️ OVERDUE' : ''}
          </span>
        )}
        {task.comments?.length > 0 && <span className="text-xs text-gray-500">💬 {task.comments.length}</span>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-5xl border border-green-600 shadow-2xl h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h2 className="text-white font-bold text-lg">Task Manager</h2>
              <p className="text-gray-400 text-xs">{tasks.length} total · {mine.filter(t=>t.status!=='done').length} assigned to you · {tasks.filter(t=>overdue(t)).length} overdue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
              + New Task
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl ml-2">✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 flex-wrap">
          {/* View tabs */}
          {['board','list','mine'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${view===v ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {v==='board'?'📋 Board':v==='list'?'📄 List':'👤 My Tasks'}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded px-2 py-1 text-xs">
              <option value="">All Statuses</option>
              {STATUSES.map(s=><option key={s} value={s}>{STATUS_ICON[s]} {s}</option>)}
            </select>
            <select value={filterChannel} onChange={e=>setFilterChannel(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-300 rounded px-2 py-1 text-xs">
              <option value="">All Channels</option>
              {CHANNELS.map(c=><option key={c} value={c}>#{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Main content */}
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading tasks...</div>
            ) : view === 'board' ? (
              /* Kanban Board */
              <div className="grid grid-cols-4 gap-3 h-full">
                {STATUSES.map(s => (
                  <div key={s} className="flex flex-col">
                    <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg ${STATUS_STYLE[s]}`}>
                      <span>{STATUS_ICON[s]}</span>
                      <span className="text-xs font-bold uppercase">{s}</span>
                      <span className="ml-auto text-xs opacity-70">{byStatus(s).length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {byStatus(s).length === 0
                        ? <p className="text-gray-600 text-xs text-center py-4">No tasks</p>
                        : byStatus(s).map(t => <TaskCard key={t._id} task={t} />)
                      }
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List view */
              <div className="space-y-1">
                {displayed.length === 0
                  ? <div className="text-center py-16 text-gray-400">No tasks found</div>
                  : displayed.map(task => (
                    <div key={task._id} onClick={() => setSelected(task)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:border-gray-500 transition ${
                        overdue(task) ? 'bg-red-900 bg-opacity-10 border-red-800' : 'bg-gray-800 border-gray-700'
                      }`}>
                      <span>{STATUS_ICON[task.status]}</span>
                      <span className="text-white text-sm font-medium flex-1">{task.title}</span>
                      <span className="text-xs text-green-400">#{task.channel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
                      {task.assigned_to && <span className="text-gray-400 text-xs">👤 {task.assigned_to}</span>}
                      {task.due_date && <span className={`text-xs ${overdue(task)?'text-red-400 font-bold':'text-gray-500'}`}>📅 {fmtDate(task.due_date)}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[task.status]}`}>{task.status}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Task detail panel */}
          {selected && (
            <div className="w-80 border-l border-gray-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-start justify-between">
                <p className="text-white font-bold text-sm leading-snug flex-1">{selected.title}</p>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white ml-2">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status */}
                <div>
                  <p className="text-gray-500 text-xs mb-1.5">Status</p>
                  <div className="grid grid-cols-2 gap-1">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateStatus(selected._id, s)}
                        className={`text-xs py-1.5 rounded transition ${selected.status===s ? STATUS_STYLE[s]+' font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {STATUS_ICON[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Meta */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={`px-2 py-0.5 rounded font-bold ${PRIORITY_STYLE[selected.priority]}`}>{selected.priority}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Channel</span><span className="text-green-400">#{selected.channel}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Created by</span><span className="text-white">{selected.created_by}</span></div>
                  {selected.assigned_to && <div className="flex justify-between"><span className="text-gray-500">Assigned to</span><span className="text-white">{selected.assigned_to}</span></div>}
                  {selected.due_date && <div className="flex justify-between"><span className="text-gray-500">Due</span><span className={overdue(selected)?'text-red-400 font-bold':'text-white'}>{fmtDate(selected.due_date)}</span></div>}
                </div>
                {/* Description */}
                {selected.description && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Description</p>
                    <p className="text-gray-300 text-xs leading-relaxed">{selected.description}</p>
                  </div>
                )}
                {/* Comments */}
                <div>
                  <p className="text-gray-500 text-xs mb-2">Comments ({selected.comments?.length || 0})</p>
                  <div className="space-y-2 mb-2">
                    {(selected.comments||[]).map((c,i) => (
                      <div key={i} className="bg-gray-800 rounded p-2">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-white text-xs font-semibold">{c.author}</span>
                          <span className="text-gray-600 text-xs">{fmtDate(c.time)}</span>
                        </div>
                        <p className="text-gray-300 text-xs">{c.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={comment} onChange={e=>setComment(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addComment()}
                      placeholder="Add comment..."
                      className="flex-1 bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-green-500" />
                    <button onClick={addComment} className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded text-xs">→</button>
                  </div>
                </div>
                {/* Delete */}
                <button onClick={()=>deleteTask(selected._id)}
                  className="w-full text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded py-1.5 text-xs transition">
                  🗑 Delete Task
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-60 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md border border-green-600 p-6">
            <h3 className="text-white font-bold text-lg mb-4">➕ New Task</h3>
            <div className="space-y-3">
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="Task title *"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}
                  placeholder="Assign to (name)"
                  className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                <input value={form.assigned_email} onChange={e=>setForm(f=>({...f,assigned_email:e.target.value}))}
                  placeholder="Email (optional)"
                  className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                  className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
                <select value={form.channel} onChange={e=>setForm(f=>({...f,channel:e.target.value}))}
                  className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {CHANNELS.map(c=><option key={c} value={c}>#{c}</option>)}
                </select>
              </div>
              <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}
                className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <div className="flex gap-2 pt-1">
                <button onClick={()=>setShowCreate(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm">Cancel</button>
                <button onClick={createTask} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Create Task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskManager;
