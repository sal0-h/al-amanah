/**
 * Tests for API client (api/client.ts)
 * Tests the request wrapper and all API functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../src/api/client';
import { mockFetch, mockFetchError, mockAdmin, mockDashboardData, mockSemester, mockTeam } from './utils';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request wrapper', () => {
    it('includes credentials in requests', async () => {
      mockFetch({ user: mockAdmin, message: 'Logged in' });
      await api.login('admin', 'password');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('sets Content-Type to application/json', async () => {
      mockFetch({ user: mockAdmin, message: 'Logged in' });
      await api.login('admin', 'password');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws error with detail message on failure', async () => {
      mockFetchError('Invalid credentials', 401);
      
      await expect(api.login('admin', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('throws generic error when no detail provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
      
      await expect(api.login('admin', 'test')).rejects.toThrow('Request failed');
    });
  });

  describe('Auth API', () => {
    it('login sends credentials and returns user', async () => {
      mockFetch({ user: mockAdmin, message: 'Logged in' });
      
      const user = await api.login('admin', 'password');
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'admin', password: 'password' }),
        })
      );
      expect(user).toEqual(mockAdmin);
    });

    it('logout calls POST /auth/logout', async () => {
      mockFetch(undefined);
      
      await api.logout();
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('getMe returns current user', async () => {
      mockFetch(mockAdmin);
      
      const user = await api.getMe();
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.any(Object)
      );
      expect(user).toEqual(mockAdmin);
    });

    it('changePassword sends current and new password', async () => {
      mockFetch({ message: 'Password changed' });
      
      await api.changePassword('oldpass', 'newpass');
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/change-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ current_password: 'oldpass', new_password: 'newpass' }),
        })
      );
    });
  });

  describe('Dashboard API', () => {
    it('getDashboard returns dashboard data', async () => {
      mockFetch(mockDashboardData);
      
      const data = await api.getDashboard();
      
      expect(fetch).toHaveBeenCalledWith('/api/dashboard', expect.any(Object));
      expect(data).toEqual(mockDashboardData);
    });
  });

  describe('Semesters API', () => {
    it('getSemesters returns list of semesters', async () => {
      mockFetch([mockSemester]);
      
      const semesters = await api.getSemesters();
      
      expect(fetch).toHaveBeenCalledWith('/api/semesters', expect.any(Object));
      expect(semesters).toEqual([mockSemester]);
    });

    it('createSemester sends POST with data', async () => {
      mockFetch(mockSemester);
      
      await api.createSemester({ name: 'Fall 2024', start_date: '2024-08-26', end_date: '2024-12-15' });
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('updateSemester sends PUT with data', async () => {
      mockFetch(mockSemester);
      
      await api.updateSemester(1, { name: 'Updated' });
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters/1',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('deleteSemester sends DELETE', async () => {
      mockFetch(undefined);
      
      await api.deleteSemester(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Tasks API', () => {
    it('markTaskDone sends PATCH to /done', async () => {
      mockFetch({ id: 1, status: 'DONE' });
      
      await api.markTaskDone(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/tasks/1/done',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('markTaskCannotDo sends PATCH with reason', async () => {
      mockFetch({ id: 1, status: 'CANNOT_DO' });
      
      await api.markTaskCannotDo(1, 'No materials');
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/tasks/1/cannot-do',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ reason: 'No materials' }),
        })
      );
    });

    it('undoTaskStatus sends PATCH to /undo', async () => {
      mockFetch({ id: 1, status: 'PENDING' });
      
      await api.undoTaskStatus(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/tasks/1/undo',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('sendTaskReminder sends POST to /send-reminder', async () => {
      mockFetch({ id: 1 });
      
      await api.sendTaskReminder(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/tasks/1/send-reminder',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('createTask includes assigned_user_ids', async () => {
      mockFetch({ id: 1 });
      
      await api.createTask(1, { title: 'Test', assigned_user_ids: [2, 3] });
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/events/1/tasks',
        expect.objectContaining({
          body: expect.stringContaining('assigned_user_ids'),
        })
      );
    });
  });

  describe('Teams API', () => {
    it('getTeams returns list of teams', async () => {
      mockFetch([mockTeam]);
      
      const teams = await api.getTeams();
      
      expect(fetch).toHaveBeenCalledWith('/api/teams', expect.any(Object));
      expect(teams).toEqual([mockTeam]);
    });

    it('createTeam sends POST with name and color', async () => {
      mockFetch(mockTeam);
      
      await api.createTeam({ name: 'Media', color: '#C4122F' });
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/teams',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Media', color: '#C4122F' }),
        })
      );
    });
  });

  describe('Roster API', () => {
    it('getRoster fetches semester roster', async () => {
      mockFetch([]);
      
      await api.getRoster(1);
      
      expect(fetch).toHaveBeenCalledWith('/api/semesters/1/roster', expect.any(Object));
    });

    it('addToRoster sends user IDs', async () => {
      mockFetch({ added: 2, skipped: 0 });
      
      await api.addToRoster(1, [2, 3]);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters/1/roster',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_ids: [2, 3] }),
        })
      );
    });

    it('addAllToRoster sends POST to add-all', async () => {
      mockFetch({ added: 10, skipped: 0 });
      
      await api.addAllToRoster(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters/1/roster/add-all',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('removeFromRoster sends DELETE', async () => {
      mockFetch(undefined);
      
      await api.removeFromRoster(1, 2);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/semesters/1/roster/2',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Statistics API', () => {
    it('getOverviewStats includes semester filter', async () => {
      mockFetch({ total_tasks: 10 });
      
      await api.getOverviewStats(1);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/stats/overview?semester_id=1',
        expect.any(Object)
      );
    });

    it('getOverviewStats works without semester filter', async () => {
      mockFetch({ total_tasks: 10 });
      
      await api.getOverviewStats();
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/stats/overview',
        expect.any(Object)
      );
    });
  });

  describe('Export/Import API', () => {
    it('exportSemester fetches specific semester', async () => {
      mockFetch({ semesters: [] });
      
      await api.exportSemester(1);
      
      expect(fetch).toHaveBeenCalledWith('/api/export/semester/1', expect.any(Object));
    });

    it('exportAll fetches all data', async () => {
      mockFetch({ semesters: [] });
      
      await api.exportAll();
      
      expect(fetch).toHaveBeenCalledWith('/api/export/all', expect.any(Object));
    });

    it('importData sends POST with skip_existing param', async () => {
      mockFetch({ semesters_created: 1 });
      
      await api.importData({ exported_at: '', version: '1', semesters: [] }, true);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/export/import?skip_existing=true',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Batch Users API', () => {
    it('batchCreateUsers sends user array', async () => {
      mockFetch({ created: 2, skipped: 0, errors: [] });
      
      await api.batchCreateUsers([
        { username: 'user1', display_name: 'User 1' },
        { username: 'user2', display_name: 'User 2' },
      ]);
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/users/batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user1'),
        })
      );
    });
  });
});
