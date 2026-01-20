import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings, ChevronDown, ChevronRight, MapPin, Clock, X, AlertTriangle, Check, Wrench, RotateCcw, Send, Calendar } from 'lucide-react';
import * as api from '../api/client';
import type { DashboardData, DashboardWeek, DashboardEvent, Task } from '../types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const loadDashboard = async () => {
    try {
      const d = await api.getDashboard();
      setData(d);
      // Auto-select current week
      const currentWeek = d.weeks.find(w => w.is_current);
      setSelectedWeek(currentWeek?.id ?? d.weeks[0]?.id ?? null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  const activeWeek = data?.weeks.find(w => w.id === selectedWeek);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-700">MSA Task Tracker</h1>
          <div className="flex items-center gap-4">
            {user?.role === 'ADMIN' && <a href="/admin" className="p-2 text-gray-500 hover:text-gray-700"><Settings size={20} /></a>}
            <span className="text-sm text-gray-600">{user?.display_name}</span>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-700"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      {!data?.semester_name ? (
        <div className="text-center py-12 text-gray-500">No active semester.</div>
      ) : (
        <>
          {/* Semester Bar */}
          <div className="bg-primary-700 text-white py-2">
            <div className="max-w-5xl mx-auto px-4 flex items-center gap-2">
              <Calendar size={18} />
              <span className="font-medium">{data.semester_name}</span>
            </div>
          </div>

          {/* Week Tabs */}
          <div className="bg-white border-b sticky top-[52px] z-10 overflow-x-auto">
            <div className="max-w-5xl mx-auto px-4 flex gap-1">
              {data.weeks.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWeek(w.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    selectedWeek === w.id 
                      ? 'border-primary-600 text-primary-700' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } ${w.is_current ? 'bg-primary-50' : ''}`}
                >
                  Week {w.week_number}
                  {w.is_current && <span className="ml-1 text-xs text-primary-600">●</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Events List - Flat, Less Nesting */}
          <main className="max-w-5xl mx-auto px-4 py-6">
            {activeWeek ? (
              <div className="space-y-4">
                {activeWeek.events.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No events this week.</p>
                ) : (
                  activeWeek.events.map((event) => (
                    <EventCard key={event.id} event={event} refresh={loadDashboard} />
                  ))
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select a week to view events.</p>
            )}
          </main>
        </>
      )}
    </div>
  );
}

function EventCard({ event, refresh }: { event: DashboardEvent; refresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Event Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 border-b"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
          <div>
            <h3 className="font-semibold text-gray-900">{event.name}</h3>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><Clock size={14} />{new Date(event.datetime).toLocaleString()}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">{event.tasks.filter(t => t.status === 'DONE').length}/{event.tasks.length} done</span>
        </div>
      </div>

      {/* Tasks - Flat List */}
      {expanded && (
        <div className="divide-y">
          {event.tasks.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">No tasks for this event.</p>
          ) : (
            event.tasks.map((task) => <TaskRow key={task.id} task={task} refresh={refresh} />)
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, refresh }: { task: Task; refresh: () => void }) {
  const { user } = useAuth();
  const [modal, setModal] = useState<'none' | 'cantdo'>('none');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Check if user can modify this task:
  // Admin OR assigned to user OR user's team matches assigned_team_id OR user is in assignees pool
  const canAct = user?.role === 'ADMIN' 
    || task.assigned_to === user?.id 
    || (task.assigned_team_id && user?.team_id === task.assigned_team_id)
    || task.assignees?.some(a => a.id === user?.id);
  const isAdmin = user?.role === 'ADMIN';

  const markDone = async () => {
    if (!canAct) return;
    setBusy(true);
    try { await api.markTaskDone(task.id); refresh(); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const undoStatus = async () => {
    if (!canAct) return;
    setBusy(true);
    try { await api.undoTaskStatus(task.id); refresh(); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const submitCantDo = async () => {
    setBusy(true);
    try { await api.markTaskCannotDo(task.id, reason); refresh(); setModal('none'); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const sendReminder = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try { await api.sendTaskReminder(task.id); alert('Reminder sent!'); } catch (e) { alert(e instanceof Error ? e.message : 'Failed to send reminder'); }
    setBusy(false);
  };

  const bg = task.status === 'DONE' ? 'bg-green-50 border-green-200' : task.status === 'CANNOT_DO' ? 'bg-amber-50 border-amber-200' : 'bg-white';

  return (
    <>
      <div className={`flex items-start justify-between p-3 rounded-lg border ${bg}`}>
        <div className="flex items-start gap-3">
          {task.task_type === 'SETUP' ? <Wrench size={20} className="text-gray-400 mt-0.5" />
            : task.status === 'DONE' ? (
              <button onClick={undoStatus} disabled={!canAct || busy} className="text-green-600 hover:text-green-800 disabled:opacity-50" title="Undo completion">
                <Check size={20} className="mt-0.5" />
              </button>
            )
            : task.status === 'CANNOT_DO' ? (
              <button onClick={undoStatus} disabled={!canAct || busy} className="text-amber-600 hover:text-amber-800 disabled:opacity-50" title="Undo status">
                <AlertTriangle size={20} className="mt-0.5" />
              </button>
            )
            : <button onClick={markDone} disabled={!canAct || busy} className="w-5 h-5 border-2 rounded mt-0.5 hover:border-primary-500 disabled:opacity-50" />}
          <div>
            <p className={task.status === 'DONE' ? 'line-through text-gray-400' : 'font-medium'}>{task.task_type === 'SETUP' && '[Setup] '}{task.title}</p>
            <p className="text-sm text-gray-500">{task.assignee_name || 'Unassigned'}</p>
            {task.status === 'DONE' && task.completed_by_name && isAdmin && (
              <p className="text-xs text-green-600">✓ Completed by {task.completed_by_name}</p>
            )}
            {task.status === 'CANNOT_DO' && task.cannot_do_reason && (
              <p className="text-sm text-amber-700 mt-1">
                Reason: {task.cannot_do_reason}
                {task.completed_by_name && isAdmin && <span className="text-xs ml-1">(by {task.completed_by_name})</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && task.status === 'PENDING' && task.task_type === 'STANDARD' && (
            <button onClick={sendReminder} disabled={busy} className="p-1.5 text-gray-400 hover:text-blue-600" title="Send reminder now"><Send size={16} /></button>
          )}
          {canAct && task.status === 'PENDING' && (
            <button onClick={() => setModal('cantdo')} className="p-1.5 text-gray-400 hover:text-amber-600" title="Mark as cannot do"><X size={16} /></button>
          )}
          {(task.status === 'DONE' || task.status === 'CANNOT_DO') && canAct && (
            <button onClick={undoStatus} disabled={busy} className="p-1.5 text-gray-400 hover:text-gray-600" title="Undo"><RotateCcw size={16} /></button>
          )}
        </div>
      </div>
      {modal === 'cantdo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Cannot Complete Task</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." className="w-full px-4 py-3 border rounded-lg resize-none" rows={3} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal('none')} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={submitCantDo} disabled={busy || !reason.trim()} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50">{busy ? '...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
