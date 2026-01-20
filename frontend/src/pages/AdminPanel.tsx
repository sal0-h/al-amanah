import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Calendar, MapPin } from 'lucide-react';
import * as api from '../api/client';
import type { Semester, Week, Event, Task, User, Team } from '../types';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'users' | 'teams'>('roster');

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
            <button
              onClick={() => setActiveTab('teams')}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${activeTab === 'teams' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}
            >
              Teams
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'roster' && <RosterManager />}
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'teams' && <TeamManager />}
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
        <div className="border-t">
          {/* Section Tabs */}
          <div className="flex border-b bg-gray-50">
            <button 
              onClick={() => setActiveSection('weeks')} 
              className={`px-4 py-2 text-sm font-medium ${activeSection === 'weeks' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
            >
              📅 Weeks & Events
            </button>
            <button 
              onClick={() => setActiveSection('roster')} 
              className={`px-4 py-2 text-sm font-medium ${activeSection === 'roster' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
            >
              👥 Roster
            </button>
          </div>

          {/* Weeks Section */}
          {activeSection === 'weeks' && (
            <div className="p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">Weeks</span>
                <button onClick={() => { setEditingWeek(null); setShowWeekForm(true); }} className="text-sm text-primary-600 hover:underline">+ Add Week</button>
              </div>
              {weeks.length === 0 ? (
                <p className="text-sm text-gray-500">No weeks yet.</p>
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
    <div className="p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600">Semester Roster ({roster.length} members)</span>
        <div className="flex gap-2">
          <button onClick={handleAddAll} className="text-xs text-green-600 hover:underline">+ Add All Users</button>
          <button onClick={() => setShowAdd(true)} className="text-xs text-primary-600 hover:underline">+ Add Selected</button>
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-gray-500">No members in this semester's roster yet.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Team</th>
                <th className="text-right py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.user_id} className="border-t">
                  <td className="py-2 px-3">{m.display_name}</td>
                  <td className="py-2 px-3">{m.team_name ? <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{m.team_name}</span> : '-'}</td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => handleRemove(m.user_id)} className="text-xs text-red-600 hover:underline">Remove</button>
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
        <p className="text-gray-500">All users are already in the roster.</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 border rounded-lg">Close</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto border rounded-lg">
        {available.map((u) => (
          <label key={u.user_id} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer">
            <input type="checkbox" checked={selected.includes(u.user_id)} onChange={() => toggle(u.user_id)} className="rounded" />
            <span>{u.display_name}</span>
            {u.team_name && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{u.team_name}</span>}
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button onClick={() => onAdd(selected)} disabled={selected.length === 0} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
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
        <label className="block text-sm font-medium mb-1">Week Number</label>
        <input type="number" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value))} min={1} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-gray-500" required />
          <p className="text-xs text-gray-400 mt-1">Auto-calculated (editable)</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
      </div>
    </form>
  );
}

function WeekCard({ week, semesterId, onEdit, onDelete }: { week: Week; semesterId: number; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
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

  async function handleTemplateCreate(data: { template_id: string; datetime: string; location?: string; event_name?: string }) {
    try {
      await api.createFromTemplate({ ...data, week_id: week.id });
      loadEvents();
      setShowTemplateForm(false);
    } catch (err) {
      console.error('Failed to create from template:', err);
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
            <div className="flex gap-2">
              <button onClick={() => setShowTemplateForm(true)} className="text-xs text-green-600 hover:underline">📋 From Template</button>
              <button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="text-xs text-primary-600 hover:underline">+ Add Event</button>
            </div>
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-gray-500">No events yet.</p>
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
            <FormModal title="Create from Template" onClose={() => setShowTemplateForm(false)}>
              <TemplateForm onSave={handleTemplateCreate} onCancel={() => setShowTemplateForm(false)} />
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

function TemplateForm({ onSave, onCancel }: { onSave: (d: { template_id: string; datetime: string; location?: string; event_name?: string }) => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<api.EventTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [datetime, setDatetime] = useState('');
  const [location, setLocation] = useState('');
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
      location: location || selectedTemplate?.default_location || undefined,
      event_name: customName || undefined
    });
  };

  if (loading) return <div className="text-center py-4">Loading templates...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Event Template</label>
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setLocation(''); setCustomName(''); }} className="w-full px-4 py-2 border rounded-lg" required>
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

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={selectedTemplate.default_location || 'No default'} className="w-full px-4 py-2 border rounded-lg" />
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
                  <span className="text-gray-500 ml-2">→ {task.assignee_name || 'Unassigned'}</span>
                  {task.status === 'DONE' && task.completed_by_name && (
                    <span className="ml-2 text-green-600">✓ by {task.completed_by_name}</span>
                  )}
                  {task.status === 'CANNOT_DO' && (
                    <span className="ml-2 text-amber-600">
                      (Blocked{task.completed_by_name && ` by ${task.completed_by_name}`})
                    </span>
                  )}
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
            <input type="radio" checked={assignType === 'multiple'} onChange={() => setAssignType('multiple')} />
            <span className="text-sm">Multiple People</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={assignType === 'team'} onChange={() => setAssignType('team')} />
            <span className="text-sm">Team</span>
          </label>
        </div>
        {assignType === 'user' && (
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value ? parseInt(e.target.value) : '')} className="w-full px-4 py-2 border rounded-lg">
            <option value="">Unassigned</option>
            {rosterMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name} ({m.username})</option>)}
          </select>
        )}
        {assignType === 'multiple' && (
          <div className="border rounded-lg max-h-48 overflow-y-auto">
            {rosterMembers.map((m) => (
              <label key={m.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
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
              <div className="p-2 bg-gray-50 text-xs text-gray-600">
                {selectedUserIds.length} selected - any can complete
              </div>
            )}
          </div>
        )}
        {assignType === 'team' && (
          <select value={assignedTeamId} onChange={(e) => setAssignedTeamId(e.target.value ? parseInt(e.target.value) : '')} className="w-full px-4 py-2 border rounded-lg">
            <option value="">Select team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Users</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowBatchForm(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50">
            📋 Batch Import
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg">
            <Plus size={16} /> Add User
          </button>
        </div>
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
                <td className="py-2 px-3">{user.team_name ? <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{user.team_name}</span> : '-'}</td>
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
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm"><strong>Created:</strong> {result.created}</p>
          <p className="text-sm"><strong>Skipped (already exist):</strong> {result.skipped}</p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-600">Errors:</p>
              <ul className="text-xs text-red-600 mt-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
        <button onClick={onComplete} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg">Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Users (CSV format)</label>
        <p className="text-xs text-gray-500 mb-2">Format: username, display_name, discord_id, role, team</p>
        <p className="text-xs text-gray-500 mb-2">Example: jsmith, John Smith, 123456789, MEMBER, MEDIA</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"# Lines starting with # are ignored\njsmith, John Smith\nmjones, Mary Jones, 123456789012345678\naadmin, Admin User, , ADMIN"}
          className="w-full px-4 py-2 border rounded-lg font-mono text-sm resize-none"
          rows={8}
          required
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
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
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
            <option value="">None</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Teams</h3>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg">
          <Plus size={16} /> Add Team
        </button>
      </div>

      <div className="space-y-2">
        {teams.map((team) => (
          <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full border" 
                style={{ backgroundColor: team.color || '#6b7280' }}
              />
              <span className="font-medium">{team.name}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(team); setShowForm(true); }} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
              <button onClick={() => handleDelete(team.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No teams yet. Create your first team!</p>}

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
        <label className="block text-sm font-medium mb-1">Team Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Team Color</label>
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg font-mono text-sm" placeholder="#3b82f6" />
        </div>
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
