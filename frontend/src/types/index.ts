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
  location: string | null;
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
