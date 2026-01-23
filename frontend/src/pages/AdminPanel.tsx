import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Calendar, FileText, Clock, Download, Upload, BarChart3, History } from 'lucide-react';
import * as api from '../api/client';
import type { Semester, Week, Event, Task, User, Team, AuditLogPage, OverviewStats, UserStats, TeamStats, SemesterStats } from '../types';
import { formatEventDateTime, formatDate } from '../utils/dateFormat';
import { ThemeToggle } from '../components/ThemeToggle';

export default function AdminPanel() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'roster' | 'users' | 'teams' | 'templates' | 'stats' | 'logs' | 'export'>('roster');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <p className="text-red-600">Access denied. Admins only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img key={theme} src={theme === 'dark' ? '/images/White_Clear.png' : '/images/MSA_main_clear.png'} alt="MSA Logo" className="h-14 w-auto" />
            <h1 className="text-xl font-serif font-bold text-primary-500">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/dashboard" className="text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">← Back to Dashboard</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 overflow-x-auto">
          <nav className="flex gap-4">
            {(['roster', 'users', 'teams', 'templates', 'stats', 'logs', 'export'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary-400'}`}
              >
                {tab === 'roster' && 'Roster'}
                {tab === 'users' && 'Users'}
                {tab === 'teams' && 'Teams'}
                {tab === 'templates' && 'Templates'}
                {tab === 'stats' && <><BarChart3 size={14} className="inline mr-1" />Stats</>}
                {tab === 'logs' && <><History size={14} className="inline mr-1" />Logs</>}
                {tab === 'export' && <><Download size={14} className="inline mr-1" />Export</>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'roster' && <RosterManager />}
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'teams' && <TeamManager />}
        {activeTab === 'templates' && <TemplateManager />}
        {activeTab === 'stats' && <StatsViewer />}
        {activeTab === 'logs' && <AuditLogViewer />}
        {activeTab === 'export' && <ExportManager />}
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
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-500 font-medium transition-colors">
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
          <SemesterForm key={editing?.id ?? 'new'} initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
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
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
        </div>
      </div>
      <label className="flex items-center gap-2 dark:text-gray-300">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-sm">Active semester</span>
      </label>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function SemesterCard({ semester, onEdit, onDelete }: { semester: Semester; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(semester.is_active);
  const [activeSection, setActiveSection] = useState<'weeks' | 'roster'>('weeks');
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={20} className="dark:text-gray-400" /> : <ChevronRight size={20} className="dark:text-gray-400" />}
          <div>
            <h3 className="font-semibold dark:text-white">{semester.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{semester.start_date} to {semester.end_date}</p>
          </div>
          {semester.is_active && <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">Active</span>}
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><Edit2 size={16} /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={16} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t dark:border-gray-700">
          {/* Section Tabs */}
          <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <button 
              onClick={() => setActiveSection('weeks')} 
              className={`px-4 py-2 text-sm font-medium ${activeSection === 'weeks' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
              📅 Weeks & Events
            </button>
            <button 
              onClick={() => setActiveSection('roster')} 
              className={`px-4 py-2 text-sm font-medium ${activeSection === 'roster' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
              👥 Roster
            </button>
          </div>

          {/* Weeks Section */}
          {activeSection === 'weeks' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Weeks</span>
                <button onClick={() => { setEditingWeek(null); setShowWeekForm(true); }} className="text-sm text-primary-500 hover:underline">+ Add Week</button>
              </div>
              {weeks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No weeks yet.</p>
              ) : (
                <div className="space-y-2">
                  {weeks.map((week) => (
                    <WeekCard key={week.id} week={week} semesterId={semester.id} onEdit={() => { setEditingWeek(week); setShowWeekForm(true); }} onDelete={() => handleDeleteWeek(week.id)} />
                  ))}
                </div>
              )}
              {showWeekForm && (
                <FormModal title={editingWeek ? 'Edit Week' : 'New Week'} onClose={() => { setShowWeekForm(false); setEditingWeek(null); }}>
                  <WeekForm key={editingWeek?.id ?? 'new'} initial={editingWeek} onSave={handleSaveWeek} onCancel={() => { setShowWeekForm(false); setEditingWeek(null); }} />
                </FormModal>
              )}
            </div>
          )}

          {/* Roster Section */}
          {activeSection === 'roster' && (
            <RosterSection semesterId={semester.id} />
          )}
        </div>
      )}
    </div>
  );
}

function RosterSection({ semesterId }: { semesterId: number }) {
  const [roster, setRoster] = useState<api.RosterMember[]>([]);
  const [available, setAvailable] = useState<api.RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadRoster(); }, [semesterId]);

  async function loadRoster() {
    try {
      const [r, a] = await Promise.all([
        api.getRoster(semesterId),
        api.getAvailableUsers(semesterId)
      ]);
      setRoster(r);
      setAvailable(a);
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAll() {
    try {
      const result = await api.addAllToRoster(semesterId);
      alert(`Added ${result.added} users, skipped ${result.skipped}`);
      loadRoster();
    } catch (err) {
      console.error('Failed to add all:', err);
    }
  }

  async function handleAdd(userIds: number[]) {
    try {
      await api.addToRoster(semesterId, userIds);
      loadRoster();
      setShowAdd(false);
    } catch (err) {
      console.error('Failed to add:', err);
    }
  }

  async function handleRemove(userId: number) {
    if (!confirm('Remove this user from the roster?')) return;
    try {
      await api.removeFromRoster(semesterId, userId);
      loadRoster();
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  }

  if (loading) return <div className="p-4 text-center text-gray-500">Loading roster...</div>;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Semester Roster ({roster.length} members)</span>
        <div className="flex gap-2">
          <button onClick={handleAddAll} className="text-xs text-green-600 dark:text-green-400 hover:underline">+ Add All Users</button>
          <button onClick={() => setShowAdd(true)} className="text-xs text-primary-500 hover:underline">+ Add Selected</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Admins can now be added to the roster and assigned tasks.</p>

      {roster.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No members in this semester's roster yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-600">
              <tr>
                <th className="text-left py-2 px-3 dark:text-gray-200">Name</th>
                <th className="text-left py-2 px-3 dark:text-gray-200">Role</th>
                <th className="text-left py-2 px-3 dark:text-gray-200">Team</th>
                <th className="text-right py-2 px-3 dark:text-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.user_id} className="border-t dark:border-gray-600">
                  <td className="py-2 px-3 dark:text-gray-200">{m.display_name}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${m.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-2 px-3">{m.team_name ? <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{m.team_name}</span> : <span className="dark:text-gray-400">-</span>}</td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => handleRemove(m.user_id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <FormModal title="Add Users to Roster" onClose={() => setShowAdd(false)}>
          <AddToRosterForm available={available} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        </FormModal>
      )}
    </div>
  );
}

function AddToRosterForm({ available, onAdd, onCancel }: { available: api.RosterMember[]; onAdd: (ids: number[]) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  if (available.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 dark:text-gray-400">All users are already in the roster.</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Close</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto border dark:border-gray-600 rounded-lg">
        {available.map((u) => (
          <label key={u.user_id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-600 last:border-b-0 cursor-pointer dark:text-gray-200">
            <input type="checkbox" checked={selected.includes(u.user_id)} onChange={() => toggle(u.user_id)} className="rounded" />
            <span>{u.display_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${u.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'}`}>
              {u.role}
            </span>
            {u.team_name && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{u.team_name}</span>}
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button onClick={() => onAdd(selected)} disabled={selected.length === 0} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg disabled:opacity-50">
          Add {selected.length} User{selected.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

function WeekForm({ initial, onSave, onCancel }: { initial: Week | null; onSave: (d: Partial<Week>) => void; onCancel: () => void }) {
  const [weekNumber, setWeekNumber] = useState(initial?.week_number || 1);
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');

  // Auto-calculate end date as 6 days after start date
  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (newStartDate) {
      const start = new Date(newStartDate);
      start.setDate(start.getDate() + 6);
      setEndDate(start.toISOString().split('T')[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ week_number: weekNumber, start_date: startDate, end_date: endDate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Week Number</label>
        <input type="number" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value))} min={1} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required title="Week starts on Sunday" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-500 dark:bg-gray-700 dark:text-white" required title="Week ends on Saturday (7 days inclusive: Sunday-Saturday)" />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Auto-calculated (editable)</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function WeekCard({ week, semesterId, onEdit, onDelete }: { week: Week; semesterId: number; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showWeekTemplateForm, setShowWeekTemplateForm] = useState(false);
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
      alert(`Failed to save event: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  async function handleTemplateCreate(data: { template_id: string; datetime: string; event_name?: string }) {
    try {
      await api.createFromTemplate({ ...data, week_id: week.id });
      loadEvents();
      setShowTemplateForm(false);
    } catch (err) {
      console.error('Failed to create from template:', err);
    }
  }

  async function handleWeekTemplateCreate(weekTemplateId: string) {
    try {
      const result = await api.createFromWeekTemplate({ week_template_id: weekTemplateId, week_id: week.id });
      alert(result.message);
      loadEvents();
      setShowWeekTemplateForm(false);
    } catch (err) {
      console.error('Failed to create from week template:', err);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={16} className="dark:text-gray-400" /> : <ChevronRight size={16} className="dark:text-gray-400" />}
          <span className="font-medium dark:text-white">Week {week.week_number}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">({week.start_date} - {week.end_date})</span>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Events</span>
            <div className="flex gap-2">
              <button onClick={() => setShowWeekTemplateForm(true)} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">📅 Week Template</button>
              <button onClick={() => setShowTemplateForm(true)} className="text-xs text-green-600 dark:text-green-400 hover:underline">📋 Event Template</button>
              <button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="text-xs text-primary-500 hover:underline">+ Add Event</button>
            </div>
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <EventCard key={event.id} event={event} semesterId={semesterId} onEdit={() => { setEditingEvent(event); setShowEventForm(true); }} onDelete={() => handleDeleteEvent(event.id)} />
              ))}
            </div>
          )}
          {showEventForm && (
            <FormModal title={editingEvent ? 'Edit Event' : 'New Event'} onClose={() => { setShowEventForm(false); setEditingEvent(null); }}>
              <EventForm key={editingEvent?.id ?? 'new'} initial={editingEvent} onSave={handleSaveEvent} onCancel={() => { setShowEventForm(false); setEditingEvent(null); }} />
            </FormModal>
          )}
          {showTemplateForm && (
            <FormModal title="Create Event from Template" onClose={() => setShowTemplateForm(false)}>
              <TemplateForm onSave={handleTemplateCreate} onCancel={() => setShowTemplateForm(false)} />
            </FormModal>
          )}
          {showWeekTemplateForm && (
            <FormModal title="Create Week from Template" onClose={() => setShowWeekTemplateForm(false)}>
              <WeekTemplateForm onSave={handleWeekTemplateCreate} onCancel={() => setShowWeekTemplateForm(false)} />
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, datetime });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Event Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Date & Time</label>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function TemplateForm({ onSave, onCancel }: { onSave: (d: { template_id: string; datetime: string; event_name?: string }) => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<api.EventTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [datetime, setDatetime] = useState('');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTemplates().then(t => { setTemplates(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !datetime) return;
    onSave({
      template_id: selectedId,
      datetime,
      event_name: customName || undefined
    });
  };

  if (loading) return <div className="text-center py-4">Loading templates...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Event Template</label>
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setCustomName(''); }} className="w-full px-4 py-2 border rounded-lg" required>
          <option value="">Select a template...</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTemplate && (
        <>
          {selectedTemplate.tasks.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">Tasks that will be created:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {selectedTemplate.tasks.map((task, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${task.task_type === 'SETUP' ? 'bg-gray-200' : 'bg-primary-100 text-primary-700'}`}>
                      {task.task_type === 'SETUP' ? '🔧' : '☐'}
                    </span>
                    {task.title}
                    {task.assigned_team_name && <span className="text-xs text-purple-600">({task.assigned_team_name})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Event Name (optional override)</label>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={selectedTemplate.name} className="w-full px-4 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date & Time</label>
            <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" disabled={!selectedId || !datetime} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Create Event</button>
      </div>
    </form>
  );
}

function WeekTemplateForm({ onSave, onCancel }: { onSave: (weekTemplateId: string) => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<api.WeekTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWeekTemplates().then(t => { setTemplates(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    onSave(selectedId);
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) return <div className="text-center py-4">Loading week templates...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Week Template</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required>
          <option value="">Select a week template...</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTemplate && (
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-sm text-purple-800 mb-2">{selectedTemplate.description}</p>
          <p className="text-xs font-medium text-purple-600 mb-2">Events that will be created:</p>
          <ul className="text-sm text-gray-700 space-y-1">
            {selectedTemplate.events.map((evt, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-purple-200 text-purple-800">
                  {dayNames[evt.day_of_week]} @ {evt.default_time}
                </span>
                <span className="capitalize">{evt.event_template_id.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" disabled={!selectedId} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50">Create All Events</button>
      </div>
    </form>
  );
}

function EventCard({ event, semesterId, onEdit, onDelete }: { event: Event; semesterId: number; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rosterMembers, setRosterMembers] = useState<api.RosterMember[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => { if (expanded) { loadTasks(); loadRosterMembers(); } }, [expanded]);

  async function loadTasks() {
    try {
      const data = await api.getTasks(event.id);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  async function loadRosterMembers() {
    try {
      const data = await api.getRoster(semesterId);
      setRosterMembers(data);
    } catch (err) {
      console.error('Failed to load roster:', err);
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
    <div className="bg-white dark:bg-gray-600 rounded border dark:border-gray-500">
      <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-500" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="dark:text-gray-300" /> : <ChevronRight size={14} className="dark:text-gray-300" />}
          <span className="font-medium text-sm dark:text-white">{event.name}</span>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
            <span className="flex items-center gap-1"><Calendar size={12} />{formatEventDateTime(event.datetime)}</span>
          </div>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><Edit2 size={12} /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={12} /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t dark:border-gray-500 p-2 bg-gray-100 dark:bg-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tasks</span>
            <button onClick={() => { setEditingTask(null); setShowTaskForm(true); }} className="text-xs text-primary-500 hover:underline">+ Add Task</button>
          </div>
          <div className="space-y-1">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between bg-white dark:bg-gray-600 p-2 rounded text-xs border dark:border-gray-500">
                <div className="dark:text-gray-200">
                  <span className={`font-medium ${task.status === 'DONE' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                    {task.task_type === 'SETUP' && <span className="text-gray-500 dark:text-gray-400">[Setup] </span>}
                    {task.title}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">→ {task.assignee_name || 'Unassigned'}</span>
                  {task.status === 'DONE' && task.completed_by_name && (
                    <span className="ml-2 text-green-600 dark:text-green-400">✓ by {task.completed_by_name}</span>
                  )}
                  {task.status === 'CANNOT_DO' && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      (Blocked{task.completed_by_name && ` by ${task.completed_by_name}`})
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingTask(task); setShowTaskForm(true); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><Edit2 size={12} /></button>
                  <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-gray-400 dark:text-gray-500 text-xs">No tasks yet.</p>}
          </div>
          {showTaskForm && (
            <FormModal title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => { setShowTaskForm(false); setEditingTask(null); }}>
              <TaskForm key={editingTask?.id ?? 'new'} initial={editingTask} rosterMembers={rosterMembers} onSave={handleSaveTask} onCancel={() => { setShowTaskForm(false); setEditingTask(null); }} />
            </FormModal>
          )}
        </div>
      )}
    </div>
  );
}

function TaskForm({ initial, rosterMembers, onSave, onCancel }: { initial: Task | null; rosterMembers: api.RosterMember[]; onSave: (d: Partial<Task> & { assigned_user_ids?: number[] }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [taskType, setTaskType] = useState<'STANDARD' | 'SETUP'>(initial?.task_type || 'STANDARD');
  const [assignType, setAssignType] = useState<'user' | 'team' | 'multiple'>(
    initial?.assigned_team_id ? 'team' : 
    (initial?.assignees && initial.assignees.length > 1) ? 'multiple' : 'user'
  );
  const [assignedTo, setAssignedTo] = useState<number | ''>(initial?.assigned_to || '');
  const [assignedTeamId, setAssignedTeamId] = useState<number | ''>(initial?.assigned_team_id || '');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(initial?.assignees?.map(a => a.id) || []);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(console.error);
  }, []);

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (assignType === 'multiple') {
      onSave({
        title,
        description: description || null,
        task_type: taskType,
        assigned_to: null,
        assigned_team_id: null,
        assigned_user_ids: selectedUserIds,
      });
    } else {
      onSave({
        title,
        description: description || null,
        task_type: taskType,
        assigned_to: assignType === 'user' ? (assignedTo || null) : null,
        assigned_team_id: assignType === 'team' ? (assignedTeamId || null) : null,
        assigned_user_ids: [],
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Task Type</label>
        <select value={taskType} onChange={(e) => setTaskType(e.target.value as 'STANDARD' | 'SETUP')} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
          <option value="STANDARD">Standard (requires completion)</option>
          <option value="SETUP">Setup (informational only)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Assign To</label>
        <div className="flex gap-4 mb-2">
          <label className="flex items-center gap-2 dark:text-gray-300">
            <input type="radio" checked={assignType === 'user'} onChange={() => setAssignType('user')} />
            <span className="text-sm">Individual</span>
          </label>
          <label className="flex items-center gap-2 dark:text-gray-300">
            <input type="radio" checked={assignType === 'multiple'} onChange={() => setAssignType('multiple')} />
            <span className="text-sm">Multiple People</span>
          </label>
          <label className="flex items-center gap-2 dark:text-gray-300">
            <input type="radio" checked={assignType === 'team'} onChange={() => setAssignType('team')} />
            <span className="text-sm">Team</span>
          </label>
        </div>
        {assignType === 'user' && (
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value ? parseInt(e.target.value) : '')} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            <option value="">Unassigned</option>
            {rosterMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name} ({m.username})</option>)}
          </select>
        )}
        {assignType === 'multiple' && (
          <div className="border dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto">
            {rosterMembers.map((m) => (
              <label key={m.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600 last:border-b-0 dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={selectedUserIds.includes(m.user_id)} 
                  onChange={() => toggleUser(m.user_id)} 
                  className="rounded"
                />
                <span className="text-sm">{m.display_name}</span>
              </label>
            ))}
            {selectedUserIds.length > 0 && (
              <div className="p-2 bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
                {selectedUserIds.length} selected - any can complete
              </div>
            )}
          </div>
        )}
        {assignType === 'team' && (
          <select value={assignedTeamId} onChange={(e) => setAssignedTeamId(e.target.value ? parseInt(e.target.value) : '')} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            <option value="">Select team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

// ============== USER MANAGEMENT ==============

function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
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

  if (loading) return <div className="text-center py-8 dark:text-gray-300">Loading...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold dark:text-white">Users</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowBatchForm(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-primary-500 text-primary-500 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-700">
            📋 Batch Import
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="text-left py-2 px-3 dark:text-gray-300">Username</th>
              <th className="text-left py-2 px-3 dark:text-gray-300">Display Name</th>
              <th className="text-left py-2 px-3 dark:text-gray-300">Role</th>
              <th className="text-left py-2 px-3 dark:text-gray-300">Team</th>
              <th className="text-left py-2 px-3 dark:text-gray-300">Discord ID</th>
              <th className="text-right py-2 px-3 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="py-2 px-3 font-medium dark:text-white">{user.username}</td>
                <td className="py-2 px-3 dark:text-gray-300">{user.display_name}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${user.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{user.role}</span>
                </td>
                <td className="py-2 px-3">{user.team_name ? <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{user.team_name}</span> : <span className="dark:text-gray-400">-</span>}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{user.discord_id || '-'}</td>
                <td className="py-2 px-3 text-right">
                  <button onClick={() => { setEditing(user); setShowForm(true); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(user.id)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">No users yet.</p>}

      {showForm && (
        <FormModal title={editing ? 'Edit User' : 'New User'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <UserForm key={editing?.id ?? 'new'} initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </FormModal>
      )}

      {showBatchForm && (
        <FormModal title="Batch Import Users" onClose={() => setShowBatchForm(false)}>
          <BatchUserForm onComplete={() => { setShowBatchForm(false); loadUsers(); }} onCancel={() => setShowBatchForm(false)} />
        </FormModal>
      )}
    </div>
  );
}

function BatchUserForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<api.BatchUserResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Parse CSV-like format: username, display_name, discord_id (optional), role (optional), team_name (optional)
      const lines = text.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const users: api.BatchUserItem[] = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        const teamName = parts[4]?.trim();
        return {
          username: parts[0],
          display_name: parts[1] || parts[0],
          discord_id: parts[2] || undefined,
          role: parts[3] || 'MEMBER',
          team_name: teamName && teamName.length > 0 ? teamName : undefined,
        };
      });

      const res = await api.batchCreateUsers(users);
      setResult(res);
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Failed to import'] });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <p className="text-sm dark:text-gray-200"><strong>Created:</strong> {result.created}</p>
          <p className="text-sm dark:text-gray-200"><strong>Skipped (already exist):</strong> {result.skipped}</p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</p>
              <ul className="text-xs text-red-600 dark:text-red-400 mt-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
        <button onClick={onComplete} className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg">Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Users (CSV format)</label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Format: username, display_name, discord_id, role, team</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Example: jsmith, John Smith, 123456789, MEMBER, MEDIA</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"# Lines starting with # are ignored\njsmith, John Smith\nmjones, Mary Jones, 123456789012345678\naadmin, Admin User, , ADMIN"}
          className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg font-mono text-sm resize-none dark:bg-gray-700 dark:text-white"
          rows={8}
          required
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg disabled:opacity-50">
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>
    </form>
  );
}

function UserForm({ initial, onSave, onCancel }: { initial: User | null; onSave: (d: Partial<User> & { password?: string }) => void; onCancel: () => void }) {
  const [username, setUsername] = useState(initial?.username || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>(initial?.role || 'MEMBER');
  const [teamId, setTeamId] = useState<string>(initial?.team_id?.toString() || '');
  const [discordId, setDiscordId] = useState(initial?.discord_id || '');
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(console.error);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<User> & { password?: string } = { 
      username, 
      display_name: displayName, 
      role, 
      team_id: teamId ? parseInt(teamId) : null, 
      discord_id: discordId || null 
    };
    if (password || !initial) data.password = password;
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required disabled={!!initial} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Display Name</label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">{initial ? 'New Password (leave blank to keep)' : 'Password'}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required={!initial} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            <option value="">None</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Discord ID</label>
        <input type="text" value={discordId} onChange={(e) => setDiscordId(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

// ============== TEAM MANAGEMENT ==============

function TeamManager() {
  const [teams, setTeams] = useState<{ id: number; name: string; color: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string; color: string | null } | null>(null);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    try {
      const data = await api.getTeams();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: { name: string; color?: string }) {
    try {
      if (editing) {
        await api.updateTeam(editing.id, data);
      } else {
        await api.createTeam(data);
      }
      loadTeams();
      setShowForm(false);
      setEditing(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save team');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this team? Users will be unassigned from this team.')) return;
    try {
      await api.deleteTeam(id);
      loadTeams();
    } catch (err) {
      console.error('Failed to delete team:', err);
    }
  }

  if (loading) return <div className="text-center py-8 dark:text-gray-300">Loading...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold dark:text-white">Teams</h3>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg">
          <Plus size={16} /> Add Team
        </button>
      </div>

      <div className="space-y-2">
        {teams.map((team) => (
          <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full border dark:border-gray-500" 
                style={{ backgroundColor: team.color || '#6b7280' }}
              />
              <span className="font-medium dark:text-white">{team.name}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(team); setShowForm(true); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><Edit2 size={14} /></button>
              <button onClick={() => handleDelete(team.id)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">No teams yet. Create your first team!</p>}

      {showForm && (
        <FormModal title={editing ? 'Edit Team' : 'New Team'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <TeamForm key={editing?.id ?? 'new'} initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </FormModal>
      )}
    </div>
  );
}

function TeamForm({ initial, onSave, onCancel }: { 
  initial: { id: number; name: string; color: string | null } | null; 
  onSave: (d: { name: string; color?: string }) => void; 
  onCancel: () => void 
}) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#3b82f6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Team Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Team Color</label>
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white" placeholder="#3b82f6" />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-gray-300">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

// ============== SHARED COMPONENTS ==============

function FormModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ============== TEMPLATE MANAGEMENT ==============

function TemplateManager() {
  const [eventTemplates, setEventTemplates] = useState<api.EventTemplate[]>([]);
  const [weekTemplates, setWeekTemplates] = useState<api.WeekTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showWeekForm, setShowWeekForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<api.EventTemplate | null>(null);
  const [editingWeek, setEditingWeek] = useState<api.WeekTemplate | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [events, weeks, teamsData] = await Promise.all([
        api.getEventTemplates(),
        api.getWeekTemplates(),
        api.getTeams()
      ]);
      setEventTemplates(events);
      setWeekTemplates(weeks);
      setTeams(teamsData);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEventTemplate(data: { name: string; tasks: api.TaskTemplate[] }) {
    try {
      if (editingEvent && editingEvent.is_custom) {
        const id = parseInt(editingEvent.id.replace('db_', ''));
        await api.updateEventTemplate(id, data);
      } else {
        await api.createEventTemplate(data);
      }
      loadData();
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  }

  async function handleDeleteEventTemplate(template: api.EventTemplate) {
    if (!template.is_custom) {
      alert('Cannot delete default templates');
      return;
    }
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      const id = parseInt(template.id.replace('db_', ''));
      await api.deleteEventTemplate(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  async function handleSaveWeekTemplate(data: { name: string; description?: string; events: api.WeekEventTemplate[] }) {
    try {
      if (editingWeek && editingWeek.is_custom) {
        const id = parseInt(editingWeek.id.replace('db_', ''));
        await api.updateWeekTemplate(id, data);
      } else {
        await api.createWeekTemplate(data);
      }
      loadData();
      setShowWeekForm(false);
      setEditingWeek(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  }

  async function handleDeleteWeekTemplate(template: api.WeekTemplate) {
    if (!template.is_custom) {
      alert('Cannot delete default templates');
      return;
    }
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      const id = parseInt(template.id.replace('db_', ''));
      await api.deleteWeekTemplate(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  if (loading) return <div className="text-center py-8 dark:text-gray-300">Loading...</div>;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      {/* Event Templates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary-500" />
            <h3 className="font-semibold dark:text-white">Event Templates</h3>
          </div>
          <button
            onClick={() => { setEditingEvent(null); setShowEventForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            <Plus size={16} /> New Template
          </button>
        </div>

        <div className="space-y-2">
          {eventTemplates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium dark:text-white">{template.name}</span>
                  {template.is_custom ? (
                    <span className="text-xs px-2 py-0.5 bg-accent-100 dark:bg-accent-900 text-accent-700 dark:text-accent-300 rounded-full">Custom</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">Default</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span>{template.tasks.length} tasks</span>
                </div>
              </div>
              <div className="flex gap-1">
                {template.is_custom && (
                  <>
                    <button
                      onClick={() => { setEditingEvent(template); setShowEventForm(true); }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteEventTemplate(template)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Week Templates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary-500" />
            <h3 className="font-semibold dark:text-white">Week Templates</h3>
          </div>
          <button
            onClick={() => { setEditingWeek(null); setShowWeekForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            <Plus size={16} /> New Template
          </button>
        </div>

        <div className="space-y-2">
          {weekTemplates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium dark:text-white">{template.name}</span>
                  {template.is_custom ? (
                    <span className="text-xs px-2 py-0.5 bg-accent-100 dark:bg-accent-900 text-accent-700 dark:text-accent-300 rounded-full">Custom</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">Default</span>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
                )}
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {template.events.map((e, i) => {
                    const eventTemplate = eventTemplates.find(t => t.id === e.event_template_id);
                    return (
                      <span key={i} className="mr-3">
                        {DAYS[e.day_of_week]}: {eventTemplate?.name || e.event_template_id} @ {e.default_time}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-1">
                {template.is_custom && (
                  <>
                    <button
                      onClick={() => { setEditingWeek(template); setShowWeekForm(true); }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteWeekTemplate(template)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Template Form Modal */}
      {showEventForm && (
        <FormModal
          title={editingEvent ? 'Edit Event Template' : 'New Event Template'}
          onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
        >
          <EventTemplateForm
            key={editingEvent?.id ?? 'new'}
            initial={editingEvent}
            teams={teams}
            onSave={handleSaveEventTemplate}
            onCancel={() => { setShowEventForm(false); setEditingEvent(null); }}
          />
        </FormModal>
      )}

      {/* Week Template Form Modal */}
      {showWeekForm && (
        <FormModal
          title={editingWeek ? 'Edit Week Template' : 'New Week Template'}
          onClose={() => { setShowWeekForm(false); setEditingWeek(null); }}
        >
          <WeekTemplateEditorForm
            key={editingWeek?.id ?? 'new'}
            initial={editingWeek}
            eventTemplates={eventTemplates}
            onSave={handleSaveWeekTemplate}
            onCancel={() => { setShowWeekForm(false); setEditingWeek(null); }}
          />
        </FormModal>
      )}
    </div>
  );
}

function EventTemplateForm({ initial, teams, onSave, onCancel }: {
  initial: api.EventTemplate | null;
  teams: Team[];
  onSave: (data: { name: string; tasks: api.TaskTemplate[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [tasks, setTasks] = useState<api.TaskTemplate[]>(initial?.tasks || []);

  const handleAddTask = () => {
    setTasks([...tasks, { title: '', description: null, task_type: 'STANDARD', assigned_team_name: null }]);
  };

  const handleUpdateTask = (index: number, field: keyof api.TaskTemplate, value: string | null) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      tasks: tasks.filter(t => t.title.trim())
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Template Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium dark:text-gray-300">Tasks</label>
          <button
            type="button"
            onClick={handleAddTask}
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            + Add Task
          </button>
        </div>

        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => handleUpdateTask(index, 'title', e.target.value)}
                  className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                  placeholder="Task title"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveTask(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  value={task.task_type}
                  onChange={(e) => handleUpdateTask(index, 'task_type', e.target.value)}
                  className="px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="SETUP">Setup</option>
                </select>
                <select
                  value={task.assigned_team_name || ''}
                  onChange={(e) => handleUpdateTask(index, 'assigned_team_name', e.target.value || null)}
                  className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                >
                  <option value="">No Team</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No tasks added yet</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
          Cancel
        </button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
          Save
        </button>
      </div>
    </form>
  );
}

function WeekTemplateEditorForm({ initial, eventTemplates, onSave, onCancel }: {
  initial: api.WeekTemplate | null;
  eventTemplates: api.EventTemplate[];
  onSave: (data: { name: string; description?: string; events: api.WeekEventTemplate[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [events, setEvents] = useState<api.WeekEventTemplate[]>(initial?.events || []);

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleAddEvent = () => {
    setEvents([...events, { event_template_id: eventTemplates[0]?.id || '', day_of_week: 0, default_time: '12:00' }]);
  };

  const handleUpdateEvent = (index: number, field: keyof api.WeekEventTemplate, value: string | number) => {
    const updated = [...events];
    updated[index] = { ...updated[index], [field]: value };
    setEvents(updated);
  };

  const handleRemoveEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || undefined,
      events
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Template Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          rows={2}
          placeholder="Brief description of this week template"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium dark:text-gray-300">Events</label>
          <button
            type="button"
            onClick={handleAddEvent}
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            + Add Event
          </button>
        </div>

        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={event.event_template_id}
                  onChange={(e) => handleUpdateEvent(index, 'event_template_id', e.target.value)}
                  className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                >
                  {eventTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveEvent(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  value={event.day_of_week}
                  onChange={(e) => handleUpdateEvent(index, 'day_of_week', parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <Clock size={14} className="text-gray-400" />
                  <input
                    type="time"
                    value={event.default_time}
                    onChange={(e) => handleUpdateEvent(index, 'default_time', e.target.value)}
                    className="px-2 py-1 border dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No events added yet</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
          Cancel
        </button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
          Save
        </button>
      </div>
    </form>
  );
}

// ============== STATISTICS VIEWER ==============

function StatsViewer() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [semesterStats, setSemesterStats] = useState<SemesterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | undefined>(undefined);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadSemestersAndSetDefault();
  }, []);

  useEffect(() => {
    if (initialized) {
      loadStats();
    }
  }, [selectedSemester, initialized]);

  async function loadSemestersAndSetDefault() {
    try {
      const data = await api.getSemesters();
      setSemesters(data);
      // Find active semester and set it as default
      const activeSemester = data.find(s => s.is_active);
      if (activeSemester) {
        setSelectedSemester(activeSemester.id);
      }
      setInitialized(true);
    } catch (err) {
      console.error(err);
      setInitialized(true);
    }
  }

  async function loadStats() {
    setLoading(true);
    try {
      const [o, u, t, s] = await Promise.all([
        api.getOverviewStats(selectedSemester),
        api.getUserStats(selectedSemester),
        api.getTeamStats(selectedSemester),
        api.getSemesterStats()
      ]);
      setOverview(o);
      setUserStats(u);
      setTeamStats(t);
      setSemesterStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Semester</label>
        <select
          value={selectedSemester ?? ''}
          onChange={(e) => setSelectedSemester(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full max-w-xs px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Time</option>
          {semesters.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
            <p className="text-3xl font-bold text-primary-500">{overview.total_tasks}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{overview.tasks_completed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{overview.tasks_pending}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
            <p className="text-3xl font-bold text-primary-500">{overview.completion_rate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
          </div>
        </div>
      )}

      {/* User Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">User Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="pb-2">Name</th>
                <th className="pb-2">Team</th>
                <th className="pb-2 text-center">Assigned</th>
                <th className="pb-2 text-center">Completed</th>
                <th className="pb-2 text-center">Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {userStats.map(u => (
                <tr key={u.user_id}>
                  <td className="py-2 text-gray-900 dark:text-gray-200">{u.display_name}</td>
                  <td className="py-2 text-gray-500 dark:text-gray-400">{u.team_name || '-'}</td>
                  <td className="py-2 text-center text-gray-900 dark:text-gray-200">{u.tasks_assigned}</td>
                  <td className="py-2 text-center text-green-600">{u.tasks_completed}</td>
                  <td className="py-2 text-center">
                    <span className={`font-medium ${u.completion_rate >= 80 ? 'text-green-600' : u.completion_rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {u.completion_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Team Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="pb-2">Team</th>
                <th className="pb-2 text-center">Members</th>
                <th className="pb-2 text-center">Tasks</th>
                <th className="pb-2 text-center">Completed</th>
                <th className="pb-2 text-center">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {teamStats.map(t => (
                <tr key={t.team_id}>
                  <td className="py-2 text-gray-900 dark:text-gray-200 font-medium">{t.team_name}</td>
                  <td className="py-2 text-center text-gray-500 dark:text-gray-400">{t.member_count}</td>
                  <td className="py-2 text-center text-gray-900 dark:text-gray-200">{t.tasks_assigned}</td>
                  <td className="py-2 text-center text-green-600">{t.tasks_completed}</td>
                  <td className="py-2 text-center font-medium text-primary-500">{t.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Semester Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Semester Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="pb-2">Semester</th>
                <th className="pb-2 text-center">Weeks</th>
                <th className="pb-2 text-center">Events</th>
                <th className="pb-2 text-center">Tasks</th>
                <th className="pb-2 text-center">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {semesterStats.map(s => (
                <tr key={s.semester_id}>
                  <td className="py-2 text-gray-900 dark:text-gray-200 font-medium">{s.semester_name}</td>
                  <td className="py-2 text-center text-gray-500 dark:text-gray-400">{s.weeks_count}</td>
                  <td className="py-2 text-center text-gray-500 dark:text-gray-400">{s.events_count}</td>
                  <td className="py-2 text-center text-gray-900 dark:text-gray-200">{s.tasks_count}</td>
                  <td className="py-2 text-center font-medium text-primary-500">{s.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== AUDIT LOG VIEWER ==============

function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, entityFilter]);

  async function loadFilters() {
    try {
      const [a, e] = await Promise.all([
        api.getAuditActions(),
        api.getAuditEntityTypes()
      ]);
      setActions(a);
      setEntities(e);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        page,
        per_page: 25,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entity</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">All Entities</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" /></div>
        ) : logs && logs.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {logs.items.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-200">{log.user_name || 'System'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-200">
                        {log.entity_type}
                        {log.entity_name && <span className="text-gray-500 dark:text-gray-400"> - {log.entity_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((page - 1) * 25) + 1} - {Math.min(page * 25, logs.total)} of {logs.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-50 dark:text-gray-300"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= logs.total_pages}
                  className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-50 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-center py-8 text-gray-500 dark:text-gray-400">No audit logs found.</p>
        )}
      </div>
    </div>
  );
}

// ============== EXPORT MANAGER ==============

function ExportManager() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<api.ImportResult | null>(null);

  useEffect(() => {
    loadSemesters();
  }, []);

  async function loadSemesters() {
    try {
      const data = await api.getSemesters();
      setSemesters(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function exportSemester(id: number) {
    setExporting(true);
    try {
      const data = await api.exportSemester(id);
      downloadJson(data, `semester_${id}_export.json`);
    } catch (err) {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const data = await api.exportAll();
      downloadJson(data, 'all_semesters_export.json');
    } catch (err) {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  }

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as api.ExportData;
      const result = await api.importData(data, true);
      setImportResult(result);
      loadSemesters();
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Invalid file'));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Download size={20} className="text-primary-500" />
          Export Data
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Export semester data including weeks, events, tasks, and roster. Exports to JSON format.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={exportAll}
            disabled={exporting}
            className="w-full px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 font-medium"
          >
            {exporting ? 'Exporting...' : 'Export All Semesters'}
          </button>
          
          <div className="grid gap-2">
            {semesters.map(s => (
              <button
                key={s.id}
                onClick={() => exportSemester(s.id)}
                disabled={exporting}
                className="flex items-center justify-between px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <span className="text-gray-900 dark:text-gray-200">{s.name}</span>
                <Download size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-primary-500" />
          Import Data
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Import semester data from a previously exported JSON file. Existing semesters with the same name will be skipped.
        </p>
        
        <label className="block">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
          <div className="border-2 border-dashed dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
            {importing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                <span className="text-gray-500 dark:text-gray-400">Importing...</span>
              </div>
            ) : (
              <>
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 dark:text-gray-300 font-medium">Click to select a file</p>
                <p className="text-sm text-gray-400">JSON export files only</p>
              </>
            )}
          </div>
        </label>

        {importResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="font-medium text-green-800 dark:text-green-300 mb-2">Import Complete</p>
            <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              <li>Semesters: {importResult.semesters_created}</li>
              <li>Weeks: {importResult.weeks_created}</li>
              <li>Events: {importResult.events_created}</li>
              <li>Tasks: {importResult.tasks_created}</li>
            </ul>
            {importResult.errors.length > 0 && (
              <div className="mt-2 text-amber-700 dark:text-amber-400">
                <p className="font-medium">Warnings:</p>
                <ul className="text-sm">
                  {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
