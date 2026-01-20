/**
 * Test utilities and mock data for frontend tests.
 */
import type { User, DashboardData, Semester, Week, Team, Task, DashboardEvent, DashboardWeek } from '../src/types';

// ============== MOCK DATA ==============

export const mockAdmin: User = {
  id: 1,
  username: 'admin',
  display_name: 'Admin User',
  role: 'ADMIN',
  discord_id: '123456789',
  team_id: null,
  team_name: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockMember: User = {
  id: 2,
  username: 'member',
  display_name: 'Member User',
  role: 'MEMBER',
  discord_id: '987654321',
  team_id: 1,
  team_name: 'Media',
  created_at: '2024-01-02T00:00:00Z',
};

export const mockTeam: Team = {
  id: 1,
  name: 'Media',
  color: '#C4122F',
};

export const mockSemester: Semester = {
  id: 1,
  name: 'Fall 2024',
  start_date: '2024-08-26',
  end_date: '2024-12-15',
  is_active: true,
};

export const mockWeek: Week = {
  id: 1,
  semester_id: 1,
  week_number: 1,
  start_date: '2024-08-26',
  end_date: '2024-09-01',
};

export const mockTask: Task = {
  id: 1,
  event_id: 1,
  title: 'Send email reminder',
  description: 'Send reminder to all members',
  task_type: 'STANDARD',
  status: 'PENDING',
  assigned_to: 2,
  assigned_team_id: null,
  assignee_name: 'Member User',
  assignees: [{ id: 2, display_name: 'Member User' }],
  completed_by: null,
  completed_by_name: null,
  reminder_time: null,
  reminder_sent: false,
  cannot_do_reason: null,
};

export const mockEvent: DashboardEvent = {
  id: 1,
  name: 'Sweet Sunday',
  datetime: '2024-08-27T14:00:00Z',
  location: 'UC Black Box',
  tasks: [mockTask],
};

export const mockDashboardWeek: DashboardWeek = {
  id: 1,
  week_number: 1,
  start_date: '2024-08-26',
  end_date: '2024-09-01',
  is_current: true,
  events: [mockEvent],
};

export const mockDashboardData: DashboardData = {
  semester_name: 'Fall 2024',
  semester_id: 1,
  weeks: [mockDashboardWeek],
  user_role: 'MEMBER',
};

export const mockEmptyDashboard: DashboardData = {
  semester_name: null,
  semester_id: null,
  weeks: [],
  user_role: 'MEMBER',
};

// ============== FETCH MOCKS ==============

export function mockFetch(response: unknown, status = 200): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  });
}

export function mockFetchError(message: string, status = 400): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ detail: message }),
  });
}

export function mockFetchNetworkError(): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error('Network error')
  );
}

// ============== TEST HELPERS ==============

export function createTaskWithStatus(status: 'PENDING' | 'DONE' | 'CANNOT_DO'): Task {
  return {
    ...mockTask,
    id: Math.floor(Math.random() * 1000),
    status,
    cannot_do_reason: status === 'CANNOT_DO' ? 'Test reason' : null,
    completed_by: status !== 'PENDING' ? 2 : null,
    completed_by_name: status !== 'PENDING' ? 'Member User' : null,
  };
}

export function createEvent(tasks: Task[]): DashboardEvent {
  return {
    ...mockEvent,
    id: Math.floor(Math.random() * 1000),
    tasks,
  };
}

export function createDashboardData(events: DashboardEvent[]): DashboardData {
  return {
    ...mockDashboardData,
    weeks: [{
      ...mockDashboardWeek,
      events,
    }],
  };
}
