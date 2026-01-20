import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings, ChevronDown, ChevronRight, MapPin, Clock, Bell, X, AlertTriangle, Check, Wrench } from 'lucide-react';
import * as api from '../api/client';
import type { DashboardData, DashboardWeek, DashboardEvent, Task } from '../types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    try {
      const d = await api.getDashboard();
      setData(d);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-700">MSA Task Tracker</h1>
          <div className="flex items-center gap-4">
            {user?.role === 'ADMIN' && <a href="/admin" className="p-2 text-gray-500 hover:text-gray-700"><Settings size={20} /></a>}
            <span className="text-sm text-gray-600">{user?.display_name}</span>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-700"><LogOut size={20} /></button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {!data?.semester ? (
          <div className="text-center py-12 text-gray-500">No active semester.</div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold">{data.semester.name}</h2>
              <p className="text-sm text-gray-500">{data.semester.start_date} to {data.semester.end_date}</p>
            </div>
            <div className="space-y-4">
              {data.weeks.map((w) => <WeekSection key={w.id} week={w} isCurrent={w.id === data.current_week_id} refresh={loadDashboard} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WeekSection({ week, isCurrent, refresh }: { week: DashboardWeek; isCurrent: boolean; refresh: () => void }) {
  const [open, setOpen] = useState(isCurrent);
  return (
    <div className={`bg-white rounded-xl border ${isCurrent ? 'ring-2 ring-primary-500' : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <span className="font-medium">Week {week.week_number}</span>
          {isCurrent && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Current</span>}
        </div>
        <span className="text-sm text-gray-500">{week.start_date} - {week.end_date}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {week.events.length === 0 ? <p className="text-gray-500 text-sm py-4">No events this week.</p> : week.events.map((e) => <EventSection key={e.id} event={e} refresh={refresh} />)}
        </div>
      )}
    </div>
  );
}

function EventSection({ event, refresh }: { event: DashboardEvent; refresh: () => void }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="font-medium">{event.name}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
          {event.location && <span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span>}
          <span className="flex items-center gap-1"><Clock size={14} />{new Date(event.datetime).toLocaleString()}</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {event.tasks.length === 0 ? <p className="text-gray-500 text-sm">No tasks.</p> : event.tasks.map((t) => <TaskRow key={t.id} task={t} refresh={refresh} />)}
      </div>
    </div>
  );
}

function TaskRow({ task, refresh }: { task: Task; refresh: () => void }) {
  const { user } = useAuth();
  const [modal, setModal] = useState<'none' | 'cantdo' | 'reminder'>('none');
  const [reason, setReason] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [busy, setBusy] = useState(false);

  const canAct = user?.role === 'ADMIN' || task.assigned_to === user?.id || (task.assigned_team === 'MEDIA' && user?.team === 'MEDIA');

  const markDone = async () => {
    if (!canAct) return;
    setBusy(true);
    try { await api.markTaskDone(task.id); refresh(); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const submitCantDo = async () => {
    setBusy(true);
    try { await api.markTaskCannotDo(task.id, reason); refresh(); setModal('none'); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const submitReminder = async () => {
    setBusy(true);
    try { await api.setTaskReminder(task.id, reminderTime); refresh(); setModal('none'); } catch (e) { console.error(e); }
    setBusy(false);
  };

  const bg = task.status === 'DONE' ? 'bg-green-50 border-green-200' : task.status === 'CANNOT_DO' ? 'bg-amber-50 border-amber-200' : 'bg-white';

  return (
    <>
      <div className={`flex items-start justify-between p-3 rounded-lg border ${bg}`}>
        <div className="flex items-start gap-3">
          {task.task_type === 'SETUP' ? <Wrench size={20} className="text-gray-400 mt-0.5" />
            : task.status === 'DONE' ? <Check size={20} className="text-green-600 mt-0.5" />
            : task.status === 'CANNOT_DO' ? <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
            : <button onClick={markDone} disabled={!canAct || busy} className="w-5 h-5 border-2 rounded mt-0.5 hover:border-primary-500 disabled:opacity-50" />}
          <div>
            <p className={task.status === 'DONE' ? 'line-through text-gray-400' : 'font-medium'}>{task.task_type === 'SETUP' && '[Setup] '}{task.title}</p>
            <p className="text-sm text-gray-500">{task.assignee_name || task.assigned_team || 'Unassigned'}</p>
            {task.status === 'CANNOT_DO' && task.cannot_do_reason && <p className="text-sm text-amber-700 mt-1">Reason: {task.cannot_do_reason}</p>}
            {task.reminder_time && !task.reminder_sent && <p className="text-sm text-blue-600 mt-1"><Bell size={12} className="inline mr-1" />Reminder: {new Date(task.reminder_time).toLocaleString()}</p>}
          </div>
        </div>
        {canAct && task.status === 'PENDING' && task.task_type === 'STANDARD' && (
          <div className="flex gap-2">
            <button onClick={() => setModal('reminder')} className="p-1.5 text-gray-400 hover:text-blue-600"><Bell size={16} /></button>
            <button onClick={() => setModal('cantdo')} className="p-1.5 text-gray-400 hover:text-amber-600"><X size={16} /></button>
          </div>
        )}
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
      {modal === 'reminder' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Set Reminder</h3>
            <input type="datetime-local" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal('none')} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={submitReminder} disabled={busy || !reminderTime} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">{busy ? '...' : 'Set'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
