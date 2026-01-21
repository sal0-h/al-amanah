export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'ADMIN' | 'MEMBER';
  team_id: number | null;
  team_name: string | null;
  discord_id: string | null;
}

export interface Team {
  id: number;
  name: string;
  color: string | null;
}

export interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Week {
  id: number;
  semester_id: number;
  week_number: number;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface Event {
  id: number;
  week_id: number;
  name: string;
  datetime: string;
}

export interface AssigneeInfo {
  id: number;
  display_name: string;
}

export interface Task {
  id: number;
  event_id: number;
  title: string;
  description: string | null;
  task_type: 'STANDARD' | 'SETUP';
  status: 'PENDING' | 'DONE' | 'CANNOT_DO';
  assigned_to: number | null;
  assigned_team_id: number | null;
  assignee_name: string | null;
  assignees: AssigneeInfo[];
  completed_by: number | null;
  completed_by_name: string | null;
  reminder_time: string | null;
  reminder_sent: boolean;
  cannot_do_reason: string | null;
}

export interface DashboardData {
  semester_name: string | null;
  semester_id: number | null;
  weeks: DashboardWeek[];
  user_role: string;
}

export interface DashboardWeek extends Week {
  is_current: boolean;
  events: DashboardEvent[];
}

export interface DashboardEvent extends Event {
  tasks: Task[];
}

// Comments
export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
  can_delete: boolean;
}

// Audit Log
export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Statistics
export interface OverviewStats {
  total_users: number;
  total_semesters: number;
  total_events: number;
  total_tasks: number;
  tasks_completed: number;
  tasks_pending: number;
  tasks_cannot_do: number;
  completion_rate: number;
}

export interface UserStats {
  user_id: number;
  display_name: string;
  team_name: string | null;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_cannot_do: number;
  completion_rate: number;
}

export interface TeamStats {
  team_id: number;
  team_name: string;
  member_count: number;
  tasks_assigned: number;
  tasks_completed: number;
  completion_rate: number;
}

export interface SemesterStats {
  semester_id: number;
  semester_name: string;
  weeks_count: number;
  events_count: number;
  tasks_count: number;
  tasks_completed: number;
  completion_rate: number;
}

export interface WeeklyActivity {
  week_number: number;
  start_date: string;
  tasks_created: number;
  tasks_completed: number;
}
