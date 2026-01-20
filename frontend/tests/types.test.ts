/**
 * Tests for TypeScript type definitions.
 * These tests verify the types compile correctly and interfaces match expectations.
 */
import { describe, it, expect } from 'vitest';
import type {
  User,
  Semester,
  Week,
  Event,
  Task,
  Team,
  DashboardData,
  DashboardWeek,
  DashboardEvent,
  TaskComment,
  AuditLog,
  AuditLogPage,
  OverviewStats,
  UserStats,
  TeamStats,
  SemesterStats,
  WeeklyActivity,
} from '../src/types';
import { mockAdmin, mockSemester, mockWeek, mockTask, mockEvent, mockDashboardData, mockTeam } from './utils';

describe('Type Definitions', () => {
  describe('User type', () => {
    it('has required fields', () => {
      const user: User = mockAdmin;
      
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.display_name).toBeDefined();
      expect(user.role).toBeDefined();
    });

    it('allows ADMIN role', () => {
      const user: User = { ...mockAdmin, role: 'ADMIN' };
      expect(user.role).toBe('ADMIN');
    });

    it('allows MEMBER role', () => {
      const user: User = { ...mockAdmin, role: 'MEMBER' };
      expect(user.role).toBe('MEMBER');
    });

    it('allows optional team fields', () => {
      const userWithTeam: User = { ...mockAdmin, team_id: 1, team_name: 'Media' };
      const userWithoutTeam: User = { ...mockAdmin, team_id: null, team_name: null };
      
      expect(userWithTeam.team_id).toBe(1);
      expect(userWithoutTeam.team_id).toBeNull();
    });
  });

  describe('Semester type', () => {
    it('has required date fields', () => {
      const semester: Semester = mockSemester;
      
      expect(semester.start_date).toBeDefined();
      expect(semester.end_date).toBeDefined();
      expect(semester.is_active).toBeDefined();
    });

    it('allows boolean is_active', () => {
      const active: Semester = { ...mockSemester, is_active: true };
      const inactive: Semester = { ...mockSemester, is_active: false };
      
      expect(active.is_active).toBe(true);
      expect(inactive.is_active).toBe(false);
    });
  });

  describe('Task type', () => {
    it('has all status fields', () => {
      const task: Task = mockTask;
      
      expect(task.status).toBeDefined();
      expect(['PENDING', 'DONE', 'CANNOT_DO']).toContain(task.status);
    });

    it('has task_type field', () => {
      const task: Task = mockTask;
      expect(['STANDARD', 'SETUP']).toContain(task.task_type);
    });

    it('supports multi-user assignment via assignees', () => {
      const task: Task = {
        ...mockTask,
        assignees: [
          { id: 1, display_name: 'User 1' },
          { id: 2, display_name: 'User 2' },
        ],
      };
      
      expect(task.assignees).toHaveLength(2);
    });

    it('supports team assignment', () => {
      const task: Task = {
        ...mockTask,
        assigned_team_id: 1,
        assignee_name: 'Media Team',
      };
      
      expect(task.assigned_team_id).toBe(1);
    });
  });

  describe('DashboardData type', () => {
    it('contains weeks array', () => {
      const data: DashboardData = mockDashboardData;
      
      expect(Array.isArray(data.weeks)).toBe(true);
    });

    it('allows null semester for no active semester', () => {
      const data: DashboardData = {
        semester_name: null,
        semester_id: null,
        weeks: [],
        user_role: 'MEMBER',
      };
      
      expect(data.semester_name).toBeNull();
    });

    it('includes user_role', () => {
      expect(mockDashboardData.user_role).toBeDefined();
    });
  });

  describe('DashboardWeek type', () => {
    it('has is_current flag', () => {
      const week: DashboardWeek = mockDashboardData.weeks[0];
      
      expect(typeof week.is_current).toBe('boolean');
    });

    it('contains events array', () => {
      const week: DashboardWeek = mockDashboardData.weeks[0];
      
      expect(Array.isArray(week.events)).toBe(true);
    });
  });

  describe('Team type', () => {
    it('has required fields', () => {
      const team: Team = mockTeam;
      
      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
    });

    it('has optional color', () => {
      const teamWithColor: Team = { ...mockTeam, color: '#C4122F' };
      const teamWithoutColor: Team = { id: 1, name: 'Test' };
      
      expect(teamWithColor.color).toBe('#C4122F');
      expect(teamWithoutColor.color).toBeUndefined();
    });
  });

  describe('Stats types', () => {
    it('OverviewStats has expected fields', () => {
      const stats: OverviewStats = {
        total_tasks: 100,
        completed_tasks: 75,
        pending_tasks: 20,
        cannot_do_tasks: 5,
        completion_rate: 75.0,
        total_events: 25,
        total_weeks: 15,
      };
      
      expect(stats.completion_rate).toBe(75.0);
    });

    it('UserStats has expected fields', () => {
      const stats: UserStats = {
        user_id: 1,
        display_name: 'Test User',
        team_name: 'Media',
        assigned_tasks: 10,
        completed_tasks: 8,
        cannot_do_tasks: 1,
        completion_rate: 80.0,
      };
      
      expect(stats.user_id).toBe(1);
    });

    it('TeamStats has expected fields', () => {
      const stats: TeamStats = {
        team_id: 1,
        team_name: 'Media',
        member_count: 5,
        assigned_tasks: 50,
        completed_tasks: 40,
        completion_rate: 80.0,
      };
      
      expect(stats.team_id).toBe(1);
    });
  });

  describe('Audit types', () => {
    it('AuditLog has required fields', () => {
      const log: AuditLog = {
        id: 1,
        action: 'TASK_DONE',
        entity_type: 'task',
        entity_id: 1,
        entity_name: 'Test Task',
        user_id: 1,
        user_display_name: 'Admin',
        details: 'Marked as done',
        created_at: '2024-01-01T00:00:00Z',
      };
      
      expect(log.action).toBe('TASK_DONE');
    });

    it('AuditLogPage has pagination', () => {
      const page: AuditLogPage = {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        pages: 0,
      };
      
      expect(page.page).toBe(1);
      expect(page.per_page).toBe(20);
    });
  });

  describe('TaskComment type', () => {
    it('has required fields', () => {
      const comment: TaskComment = {
        id: 1,
        task_id: 1,
        user_id: 1,
        user_display_name: 'Admin',
        content: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
      };
      
      expect(comment.content).toBe('Test comment');
    });
  });
});
