import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Calendar, MapPin } from 'lucide-react';
import * as api from '../api/client';
import type { Semester, Week, Event, Task, User } from '../types';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'users'>('roster');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Access denied. Admins only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-700">Admin Panel</h1>
          <a href="/dashboard" className="text-sm text-primary-600 hover:underline">← Back to Dashboard</a>
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('roster')}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${activeTab === 'roster' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}
            >
              Roster Management
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}
            >
              Users
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'roster' ? <RosterManager /> : <UserManager />}
      </main>
    </div>
  );
}

// ============== ROSTER MANAGEMENT ==============

function RosterManager() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);

  useEffect(() => { loadSemesters(); }, []);

  async function loadSemesters() {
    try {
      const data = await api.getSemesters();
      setSemesters(data);
    } catch (err) {
      console.error('Failed to load semesters:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Partial<Semester>) {
    try {
      if (editing) {
        await api.updateSemester(editing.id, data);
      } else {
        await api.createSemester(data);
      }
      loadSemesters();
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this semester and all its data?')) return;
    try {
      await api.deleteSemester(id);
      loadSemesters();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Semesters</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus size={16} /> New Semester
        </button>
      </div>

      {semesters.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No semesters yet.</p>
      ) : (
        <div className="space-y-4">
          {semesters.map((sem) => (
            <SemesterCard key={sem.id} semester={sem} onEdit={() => { setEditing(sem); setShowForm(true); }} onDelete={() => handleDelete(sem.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <FormModal title={editing ? 'Edit Semester' : 'New Semester'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <SemesterForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </FormModal>
      )}
    </div>
  );
}

function SemesterForm({ initial, onSave, onCancel }: { initial: Semester | null; onSave: (d: Partial<Semester>) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, start_date: startDate, end_date: endDate, is_active: isActive });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-sm">Active semester</span>
      </label>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function SemesterCard({ semester, onEdit, onDelete }: { semester: Semester; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(semester.is_active);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [showWeekForm, setShowWeekForm] = useState(false);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);

  useEffect(() => { if (expanded) loadWeeks(); }, [expanded]);

  async function loadWeeks() {
    try {
      const data = await api.getWeeks(semester.id);
      setWeeks(data);
    } catch (err) {
      console.error('Failed to load weeks:', err);
    }
  }

  async function handleSaveWeek(data: Partial<Week>) {
    try {
      if (editingWeek) {
        await api.updateWeek(editingWeek.id, data);
      } else {
        await api.createWeek(semester.id, data);
      }
      loadWeeks();
      setShowWeekForm(false);
      setEditingWeek(null);
    } catch (err) {
      console.error('Failed to save week:', err);
    }
  }

  async function handleDeleteWeek(id: number) {
    if (!confirm('Delete this week?')) return;
    try {
      await api.deleteWeek(id);
      loadWeeks();
    } catch (err) {
      console.error('Failed to delete week:', err);
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <div>
            <h3 className="font-semibold">{semester.name}</h3>
            <p className="text-sm text-gray-500">{semester.start_date} to {semester.end_date}</p>
          </div>
          {semester.is_active && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Active</span>}
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-gray-600"><Edit2 size={16} /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Weeks</span>
            <button onClick={() => { setEditingWeek(null); setShowWeekForm(true); }} className="text-sm text-primary-600 hover:underline">+ Add Week</button>
          </div>
          {weeks.length === 0 ? (
            <p className="text-sm text-gray-500">No weeks yet.</p>
          ) : (
            <div className="space-y-2">
              {weeks.map((week) => (
                <WeekCard key={week.id} week={week} onEdit={() => { setEditingWeek(week); setShowWeekForm(true); }} onDelete={() => handleDeleteWeek(week.id)} />
              ))}
            </div>
          )}
          {showWeekForm && (
            <FormModal title={editingWeek ? 'Edit Week' : 'New Week'} onClose={() => { setShowWeekForm(false); setEditingWeek(null); }}>
              <WeekForm initial={editingWeek} onSave={handleSaveWeek} onCancel={() => { setShowWeekForm(false); setEditingWeek(null); }} />
            </FormModal>
          )}
        </div>
      )}
    </div>
  );
}

function WeekForm({ initial, onSave, onCancel }: { initial: Week | null; onSave: (d: Partial<Week>) => void; onCancel: () => void }) {
  const [weekNumber, setWeekNumber] = useState(initial?.week_number || 1);
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ week_number: weekNumber, start_date: startDate, end_date: endDate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Week Number</label>
        <input type="number" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value))} min={1} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function WeekCard({ week, onEdit, onDelete }: { week: Week; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => { if (expanded) loadEvents(); }, [expanded]);

  async function loadEvents() {
    try {
      const data = await api.getEvents(week.id);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }

  async function handleSaveEvent(data: Partial<Event>) {
    try {
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, data);
      } else {
        await api.createEvent(week.id, data);
      }
      loadEvents();
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  }

  async function handleDeleteEvent(id: number) {
    if (!confirm('Delete this event?')) return;
    try {
      await api.deleteEvent(id);
      loadEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium">Week {week.week_number}</span>
          <span className="text-sm text-gray-500">({week.start_date} - {week.end_date})</span>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Events</span>
            <button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="text-xs text-primary-600 hover:underline">+ Add Event</button>
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-gray-500">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <EventCard key={event.id} event={event} onEdit={() => { setEditingEvent(event); setShowEventForm(true); }} onDelete={() => handleDeleteEvent(event.id)} />
              ))}
            </div>
          )}
          {showEventForm && (
            <FormModal title={editingEvent ? 'Edit Event' : 'New Event'} onClose={() => { setShowEventForm(false); setEditingEvent(null); }}>
              <EventForm initial={editingEvent} onSave={handleSaveEvent} onCancel={() => { setShowEventForm(false); setEditingEvent(null); }} />
            </FormModal>
          )}
        </div>
      )}
    </div>
  );
}

function EventForm({ initial, onSave, onCancel }: { initial: Event | null; onSave: (d: Partial<Event>) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [datetime, setDatetime] = useState(initial?.datetime?.slice(0, 16) || '');
  const [location, setLocation] = useState(initial?.location || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, datetime, location: location || null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Event Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date & Time</label>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Location (optional)</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function EventCard({ event, onEdit, onDelete }: { event: Event; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => { if (expanded) { loadTasks(); loadUsers(); } }, [expanded]);

  async function loadTasks() {
    try {
      const data = await api.getTasks(event.id);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function handleSaveTask(data: Partial<Task>) {
    try {
      if (editingTask) {
        await api.updateTask(editingTask.id, data);
      } else {
        await api.createTask(event.id, data);
      }
      loadTasks();
      setShowTaskForm(false);
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  }

  async function handleDeleteTask(id: number) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.deleteTask(id);
      loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }

  return (
    <div className="bg-white rounded border">
      <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium text-sm">{event.name}</span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {event.location && <span className="flex items-center gap-1"><MapPin size={12} />{event.location}</span>}
            <span className="flex items-center gap-1"><Calendar size={12} />{new Date(event.datetime).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={12} /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-2 bg-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Tasks</span>
            <button onClick={() => { setEditingTask(null); setShowTaskForm(true); }} className="text-xs text-primary-600 hover:underline">+ Add Task</button>
          </div>
          <div className="space-y-1">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between bg-white p-2 rounded text-xs border">
                <div>
                  <span className={`font-medium ${task.status === 'DONE' ? 'line-through text-gray-400' : ''}`}>
                    {task.task_type === 'SETUP' && <span className="text-gray-500">[Setup] </span>}
                    {task.title}
                  </span>
                  <span className="text-gray-500 ml-2">→ {task.assignee_name || task.assigned_team || 'Unassigned'}</span>
                  {task.status === 'CANNOT_DO' && <span className="ml-2 text-amber-600">(Blocked)</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingTask(task); setShowTaskForm(true); }} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={12} /></button>
                  <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-gray-400 text-xs">No tasks yet.</p>}
          </div>
          {showTaskForm && (
            <FormModal title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => { setShowTaskForm(false); setEditingTask(null); }}>
              <TaskForm initial={editingTask} users={users} onSave={handleSaveTask} onCancel={() => { setShowTaskForm(false); setEditingTask(null); }} />
            </FormModal>
          )}
        </div>
      )}
    </div>
  );
}

function TaskForm({ initial, users, onSave, onCancel }: { initial: Task | null; users: User[]; onSave: (d: Partial<Task>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [taskType, setTaskType] = useState<'STANDARD' | 'SETUP'>(initial?.task_type || 'STANDARD');
  const [assignType, setAssignType] = useState<'user' | 'team'>(initial?.assigned_team ? 'team' : 'user');
  const [assignedTo, setAssignedTo] = useState<number | ''>(initial?.assigned_to || '');
  const [assignedTeam, setAssignedTeam] = useState(initial?.assigned_team || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description: description || null,
      task_type: taskType,
      assigned_to: assignType === 'user' ? (assignedTo || null) : null,
      assigned_team: assignType === 'team' ? (assignedTeam as 'MEDIA' | null) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border rounded-lg resize-none" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Task Type</label>
        <select value={taskType} onChange={(e) => setTaskType(e.target.value as 'STANDARD' | 'SETUP')} className="w-full px-4 py-2 border rounded-lg">
          <option value="STANDARD">Standard (requires completion)</option>
          <option value="SETUP">Setup (informational only)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Assign To</label>
        <div className="flex gap-4 mb-2">
          <label className="flex items-center gap-2">
            <input type="radio" checked={assignType === 'user'} onChange={() => setAssignType('user')} />
            <span className="text-sm">Individual</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={assignType === 'team'} onChange={() => setAssignType('team')} />
            <span className="text-sm">Team</span>
          </label>
        </div>
        {assignType === 'user' ? (
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value ? parseInt(e.target.value) : '')} className="w-full px-4 py-2 border rounded-lg">
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.username})</option>)}
          </select>
        ) : (
          <select value={assignedTeam} onChange={(e) => setAssignedTeam(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
            <option value="">Select team</option>
            <option value="MEDIA">Media Team</option>
          </select>
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

// ============== USER MANAGEMENT ==============

function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Partial<User> & { password?: string }) {
    try {
      if (editing) {
        await api.updateUser(editing.id, data);
      } else {
        await api.createUser(data as Partial<User> & { password: string });
      }
      loadUsers();
      setShowForm(false);
      setEditing(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Users</h3>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Username</th>
              <th className="text-left py-2 px-3">Display Name</th>
              <th className="text-left py-2 px-3">Role</th>
              <th className="text-left py-2 px-3">Team</th>
              <th className="text-left py-2 px-3">Discord ID</th>
              <th className="text-right py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium">{user.username}</td>
                <td className="py-2 px-3">{user.display_name}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{user.role}</span>
                </td>
                <td className="py-2 px-3">{user.team ? <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{user.team}</span> : '-'}</td>
                <td className="py-2 px-3 text-gray-500 font-mono text-xs">{user.discord_id || '-'}</td>
                <td className="py-2 px-3 text-right">
                  <button onClick={() => { setEditing(user); setShowForm(true); }} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(user.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No users yet.</p>}

      {showForm && (
        <FormModal title={editing ? 'Edit User' : 'New User'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <UserForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </FormModal>
      )}
    </div>
  );
}

function UserForm({ initial, onSave, onCancel }: { initial: User | null; onSave: (d: Partial<User> & { password?: string }) => void; onCancel: () => void }) {
  const [username, setUsername] = useState(initial?.username || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>(initial?.role || 'MEMBER');
  const [team, setTeam] = useState<'MEDIA' | ''>(initial?.team || '');
  const [discordId, setDiscordId] = useState(initial?.discord_id || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<User> & { password?: string } = { username, display_name: displayName, role, team: team || null, discord_id: discordId || null };
    if (password || !initial) data.password = password;
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required disabled={!!initial} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Display Name</label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{initial ? 'New Password (leave blank to keep)' : 'Password'}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required={!initial} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="w-full px-4 py-2 border rounded-lg">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Team</label>
          <select value={team} onChange={(e) => setTeam(e.target.value as 'MEDIA' | '')} className="w-full px-4 py-2 border rounded-lg">
            <option value="">None</option>
            <option value="MEDIA">Media</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Discord ID</label>
        <input type="text" value={discordId} onChange={(e) => setDiscordId(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

// ============== SHARED COMPONENTS ==============

function FormModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
