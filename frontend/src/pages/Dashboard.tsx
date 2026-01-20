import { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings, ChevronDown, ChevronRight, MapPin, Clock, X, AlertTriangle, Check, Wrench, RotateCcw, Send, Calendar, Key, Bell } from 'lucide-react';
import * as api from '../api/client';
import type { DashboardData, DashboardWeek, DashboardEvent, Task } from '../types';
import { formatEventDateTime } from '../utils/dateFormat';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadDashboard = useCallback(async (preserveWeek = false) => {
    try {
      const d = await api.getDashboard();
      setData(d);
      // Only auto-select current week on initial load, not on refresh
      if (!preserveWeek || selectedWeek === null) {
        const currentWeek = d.weeks.find(w => w.is_current);
        setSelectedWeek(currentWeek?.id ?? d.weeks[0]?.id ?? null);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [selectedWeek]);

  // Initial load
  useEffect(() => { loadDashboard(false); }, []);
  
  // Refresh function that preserves current week
  const refresh = useCallback(() => loadDashboard(true), [loadDashboard]);

  // Optimistic update for task status changes
  const updateTaskOptimistically = useCallback((taskId: number, updates: Partial<Task>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weeks: prev.weeks.map(week => ({
          ...week,
          events: week.events.map(event => ({
            ...event,
            tasks: event.tasks.map(task => 
              task.id === taskId ? { ...task, ...updates } : task
            )
          }))
        }))
      };
    });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600 dark:bg-gray-900">{error}</div>;

  const activeWeek = data?.weeks.find(w => w.id === selectedWeek);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/MSA_main_clear.png" alt="MSA Logo" className="h-14 w-auto" />
            <h1 className="text-xl font-serif font-bold text-primary-500">Task Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setShowPasswordModal(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors" title="Change Password"><Key size={20} /></button>
            {user?.role === 'ADMIN' && <a href="/admin" className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"><Settings size={20} /></a>}
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{user?.display_name}</span>
            <button onClick={logout} className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      {!data?.semester_name ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">No active semester.</div>
      ) : (
        <>
          {/* Semester Bar */}
          <div className="bg-primary-500 text-white py-3">
            <div className="max-w-5xl mx-auto px-4 flex items-center gap-2">
              <Calendar size={18} />
              <span className="font-serif font-semibold text-lg">{data.semester_name}</span>
            </div>
          </div>

          {/* Week Tabs */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-[52px] z-10 overflow-x-auto shadow-sm">
            <div className="max-w-5xl mx-auto px-4 flex gap-1">
              {data.weeks.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWeek(w.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    selectedWeek === w.id 
                      ? 'border-primary-500 text-primary-500' 
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary-400'
                  } ${w.is_current ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                >
                  Week {w.week_number}
                  {w.is_current && <span className="ml-1 text-xs text-accent-400">●</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Events List - Flat, Less Nesting */}
          <main className="max-w-5xl mx-auto px-4 py-6">
            {activeWeek ? (
              <div className="space-y-4">
                {activeWeek.events.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No events this week.</p>
                ) : (
                  activeWeek.events.map((event) => (
                    <EventCard key={event.id} event={event} refresh={refresh} updateTask={updateTaskOptimistically} isAdmin={user?.role === 'ADMIN'} />
                  ))
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Select a week to view events.</p>
            )}
          </main>
        </>
      )}
      
      {/* Password Change Modal */}
      {showPasswordModal && <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change password');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border-t-4 border-primary-500 shadow-lg">
        <h3 className="text-lg font-serif font-semibold mb-4 text-gray-900 dark:text-white">Change Password</h3>
        {success ? (
          <div className="text-green-600 dark:text-green-400 text-center py-4">Password changed successfully!</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none"
              required
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none"
              required
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none"
              required
            />
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium dark:text-white">Cancel</button>
              <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors">{busy ? '...' : 'Change Password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const EventCard = memo(function EventCard({ event, refresh, updateTask, isAdmin }: { event: DashboardEvent; refresh: () => void; updateTask: (taskId: number, updates: Partial<Task>) => void; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  
  const pendingCount = event.tasks.filter(t => t.status === 'PENDING' && t.task_type === 'STANDARD').length;
  
  const sendAllReminders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pendingCount) return;
    setSendingReminders(true);
    try {
      const result = await api.sendEventReminders(event.id);
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-l-accent-400 border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
      {/* Event Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={20} className="text-primary-400" /> : <ChevronRight size={20} className="text-primary-400" />}
          <div>
            <h3 className="font-serif font-semibold text-gray-900 dark:text-white text-lg">{event.name}</h3>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1"><Clock size={14} className="text-primary-400" />{formatEventDateTime(event.datetime)}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin size={14} className="text-primary-400" />{event.location}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isAdmin && pendingCount > 0 && (
            <button
              onClick={sendAllReminders}
              disabled={sendingReminders}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              title={`Send reminders for ${pendingCount} pending tasks`}
            >
              <Bell size={14} />
              {sendingReminders ? '...' : `Remind All (${pendingCount})`}
            </button>
          )}
          <span className="px-2 py-1 bg-stone-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 font-medium">{event.tasks.filter(t => t.status === 'DONE').length}/{event.tasks.length} done</span>
        </div>
      </div>

      {/* Tasks - Flat List */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {event.tasks.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm p-4">No tasks for this event.</p>
          ) : (
            event.tasks.map((task) => <TaskRow key={task.id} task={task} refresh={refresh} updateTask={updateTask} />)
          )}
        </div>
      )}
    </div>
  );
});

const TaskRow = memo(function TaskRow({ task, refresh, updateTask }: { task: Task; refresh: () => void; updateTask: (taskId: number, updates: Partial<Task>) => void }) {
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
    if (!canAct || busy) return;
    setBusy(true);
    // Optimistic update - immediately update the UI
    updateTask(task.id, { 
      status: 'DONE', 
      completed_by: user?.id, 
      completed_by_name: user?.display_name 
    });
    try { 
      await api.markTaskDone(task.id); 
    } catch (e) { 
      console.error(e);
      // Revert on error
      updateTask(task.id, { status: 'PENDING', completed_by: null, completed_by_name: null });
    }
    setBusy(false);
  };

  const undoStatus = async () => {
    if (!canAct || busy) return;
    setBusy(true);
    const previousStatus = task.status;
    const previousReason = task.cannot_do_reason;
    const previousCompletedBy = task.completed_by;
    const previousCompletedByName = task.completed_by_name;
    // Optimistic update
    updateTask(task.id, { 
      status: 'PENDING', 
      cannot_do_reason: null, 
      completed_by: null, 
      completed_by_name: null 
    });
    try { 
      await api.undoTaskStatus(task.id); 
    } catch (e) { 
      console.error(e);
      // Revert on error
      updateTask(task.id, { 
        status: previousStatus, 
        cannot_do_reason: previousReason,
        completed_by: previousCompletedBy,
        completed_by_name: previousCompletedByName
      });
    }
    setBusy(false);
  };

  const submitCantDo = async () => {
    if (busy) return;
    setBusy(true);
    // Optimistic update
    updateTask(task.id, { 
      status: 'CANNOT_DO', 
      cannot_do_reason: reason,
      completed_by: user?.id,
      completed_by_name: user?.display_name
    });
    setModal('none');
    try { 
      await api.markTaskCannotDo(task.id, reason); 
    } catch (e) { 
      console.error(e);
      // Revert on error
      updateTask(task.id, { 
        status: 'PENDING', 
        cannot_do_reason: null,
        completed_by: null,
        completed_by_name: null
      });
    }
    setBusy(false);
    setReason('');
  };

  const sendReminder = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try { await api.sendTaskReminder(task.id); alert('Reminder sent!'); } catch (e) { alert(e instanceof Error ? e.message : 'Failed to send reminder'); }
    setBusy(false);
  };

  const bg = task.status === 'DONE' ? 'bg-green-50 dark:bg-green-900/20' : task.status === 'CANNOT_DO' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-white dark:bg-gray-800';

  return (
    <>
      <div className={`flex items-start justify-between p-3 ${bg} hover:bg-stone-50 dark:hover:bg-gray-700 transition-colors`}>
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
            : <button onClick={markDone} disabled={!canAct || busy} className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded mt-0.5 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 transition-colors" />}
          <div>
            <p className={task.status === 'DONE' ? 'line-through text-gray-400' : 'font-medium text-gray-800 dark:text-gray-200'}>{task.task_type === 'SETUP' && <span className="text-primary-400">[Setup] </span>}{task.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{task.assignee_name || 'Unassigned'}</p>
            {task.status === 'DONE' && task.completed_by_name && isAdmin && (
              <p className="text-xs text-green-600 dark:text-green-400">✓ Completed by {task.completed_by_name}</p>
            )}
            {task.status === 'CANNOT_DO' && task.cannot_do_reason && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Reason: {task.cannot_do_reason}
                {task.completed_by_name && isAdmin && <span className="text-xs ml-1">(by {task.completed_by_name})</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && task.status === 'PENDING' && task.task_type === 'STANDARD' && (
            <button onClick={sendReminder} disabled={busy} className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors" title="Send reminder now"><Send size={16} /></button>
          )}
          {canAct && task.status === 'PENDING' && (
            <button onClick={() => setModal('cantdo')} className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors" title="Mark as cannot do"><X size={16} /></button>
          )}
          {(task.status === 'DONE' || task.status === 'CANNOT_DO') && canAct && (
            <button onClick={undoStatus} disabled={busy} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Undo"><RotateCcw size={16} /></button>
          )}
        </div>
      </div>
      {modal === 'cantdo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border-t-4 border-accent-400 shadow-lg">
            <h3 className="text-lg font-serif font-semibold mb-4 text-gray-900 dark:text-white">Cannot Complete Task</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-colors" rows={3} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal('none')} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium dark:text-white">Cancel</button>
              <button onClick={submitCantDo} disabled={busy || !reason.trim()} className="flex-1 px-4 py-2 bg-accent-400 text-gray-900 font-medium rounded-lg hover:bg-accent-500 disabled:opacity-50 transition-colors">{busy ? '...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
