import type { User, Semester, Week, Event, Task, DashboardData, Team } from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
interface LoginResponse {
  message: string;
  user: User;
}

export const login = async (username: string, password: string): Promise<User> => {
  const response = await request<LoginResponse>('/auth/login', { 
    method: 'POST', 
    body: JSON.stringify({ username, password }) 
  });
  return response.user;
};

export const logout = () => 
  request<void>('/auth/logout', { method: 'POST' });

export const getMe = () => 
  request<User>('/auth/me');

// Dashboard
export const getDashboard = () => 
  request<DashboardData>('/dashboard');

// Semesters
export const getSemesters = () => 
  request<Semester[]>('/semesters');

export const createSemester = (data: Partial<Semester>) => 
  request<Semester>('/semesters', { method: 'POST', body: JSON.stringify(data) });

export const updateSemester = (id: number, data: Partial<Semester>) => 
  request<Semester>(`/semesters/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSemester = (id: number) => 
  request<void>(`/semesters/${id}`, { method: 'DELETE' });

// Weeks
export const getWeeks = (semesterId: number) => 
  request<Week[]>(`/semesters/${semesterId}/weeks`);

export const createWeek = (semesterId: number, data: Partial<Week>) => 
  request<Week>(`/semesters/${semesterId}/weeks`, { method: 'POST', body: JSON.stringify(data) });

export const updateWeek = (id: number, data: Partial<Week>) => 
  request<Week>(`/weeks/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteWeek = (id: number) => 
  request<void>(`/weeks/${id}`, { method: 'DELETE' });

// Events
export const getEvents = (weekId: number) => 
  request<Event[]>(`/weeks/${weekId}/events`);

export const createEvent = (weekId: number, data: Partial<Event>) => 
  request<Event>(`/weeks/${weekId}/events`, { method: 'POST', body: JSON.stringify(data) });

export const updateEvent = (id: number, data: Partial<Event>) => 
  request<Event>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteEvent = (id: number) => 
  request<void>(`/events/${id}`, { method: 'DELETE' });

// Tasks
export const getTasks = (eventId: number) => 
  request<Task[]>(`/events/${eventId}/tasks`);

export const createTask = (eventId: number, data: Partial<Task> & { assigned_user_ids?: number[] }) => 
  request<Task>(`/events/${eventId}/tasks`, { method: 'POST', body: JSON.stringify(data) });

export const updateTask = (id: number, data: Partial<Task> & { assigned_user_ids?: number[] }) => 
  request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTask = (id: number) => 
  request<void>(`/tasks/${id}`, { method: 'DELETE' });

export const markTaskDone = (id: number) => 
  request<Task>(`/tasks/${id}/done`, { method: 'PATCH' });

export const markTaskCannotDo = (id: number, reason: string) => 
  request<Task>(`/tasks/${id}/cannot-do`, { method: 'PATCH', body: JSON.stringify({ reason }) });

export const undoTaskStatus = (id: number) => 
  request<Task>(`/tasks/${id}/undo`, { method: 'PATCH' });

export const sendTaskReminder = (id: number) => 
  request<Task>(`/tasks/${id}/send-reminder`, { method: 'POST' });

// Users
export const getUsers = () => 
  request<User[]>('/users');

export const createUser = (data: Partial<User> & { password: string }) => 
  request<User>('/users', { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (id: number, data: Partial<User> & { password?: string }) => 
  request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUser = (id: number) => 
  request<void>(`/users/${id}`, { method: 'DELETE' });

// Batch Users
export interface BatchUserItem {
  username: string;
  display_name: string;
  password?: string;
  discord_id?: string;
  role?: string;
  team_id?: number;
  team_name?: string;  // Alternative to team_id - will lookup by name
}

export interface BatchUserResult {
  created: number;
  skipped: number;
  errors: string[];
}

export const batchCreateUsers = (users: BatchUserItem[]) =>
  request<BatchUserResult>('/users/batch', { method: 'POST', body: JSON.stringify({ users }) });

// Teams
export const getTeams = () => 
  request<Team[]>('/teams');

export const createTeam = (data: { name: string; color?: string }) => 
  request<Team>('/teams', { method: 'POST', body: JSON.stringify(data) });

export const updateTeam = (id: number, data: { name?: string; color?: string }) => 
  request<Team>(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTeam = (id: number) => 
  request<void>(`/teams/${id}`, { method: 'DELETE' });

// Templates
export interface TaskTemplate {
  title: string;
  description: string | null;
  task_type: string;
  assigned_team_name: string | null;
}

export interface EventTemplate {
  id: string;
  name: string;
  default_location: string | null;
  tasks: TaskTemplate[];
}

export const getTemplates = () => 
  request<EventTemplate[]>('/templates');

export const createFromTemplate = (data: {
  template_id: string;
  week_id: number;
  datetime: string;
  location?: string;
  event_name?: string;
}) => 
  request<{ message: string; event_id: number }>('/templates/create', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  });

// Roster Management
export interface RosterMember {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  role: string;
  team_id: number | null;
  team_name: string | null;
  discord_id: string | null;
}

export interface RosterActionResult {
  added: number;
  skipped: number;
}

export const getRoster = (semesterId: number) =>
  request<RosterMember[]>(`/semesters/${semesterId}/roster`);

export const getAvailableUsers = (semesterId: number) =>
  request<RosterMember[]>(`/semesters/${semesterId}/available-users`);

export const addToRoster = (semesterId: number, userIds: number[]) =>
  request<RosterActionResult>(`/semesters/${semesterId}/roster`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds })
  });

export const addAllToRoster = (semesterId: number) =>
  request<RosterActionResult>(`/semesters/${semesterId}/roster/add-all`, { method: 'POST' });

export const removeFromRoster = (semesterId: number, userId: number) =>
  request<void>(`/semesters/${semesterId}/roster/${userId}`, { method: 'DELETE' });
