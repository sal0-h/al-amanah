import type { User, Semester, Week, Event, Task, DashboardData } from '../types';

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
export const login = (username: string, password: string) =>
  request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

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

export const createTask = (eventId: number, data: Partial<Task>) => 
  request<Task>(`/events/${eventId}/tasks`, { method: 'POST', body: JSON.stringify(data) });

export const updateTask = (id: number, data: Partial<Task>) => 
  request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTask = (id: number) => 
  request<void>(`/tasks/${id}`, { method: 'DELETE' });

export const markTaskDone = (id: number) => 
  request<Task>(`/tasks/${id}/done`, { method: 'PATCH' });

export const markTaskCannotDo = (id: number, reason: string) => 
  request<Task>(`/tasks/${id}/cannot-do`, { method: 'PATCH', body: JSON.stringify({ reason }) });

export const setTaskReminder = (id: number, reminderTime: string) => 
  request<Task>(`/tasks/${id}/reminder`, { method: 'PATCH', body: JSON.stringify({ reminder_time: reminderTime }) });

// Users
export const getUsers = () => 
  request<User[]>('/users');

export const createUser = (data: Partial<User> & { password: string }) => 
  request<User>('/users', { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (id: number, data: Partial<User> & { password?: string }) => 
  request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUser = (id: number) => 
  request<void>(`/users/${id}`, { method: 'DELETE' });
