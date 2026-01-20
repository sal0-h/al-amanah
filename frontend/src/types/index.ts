export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'ADMIN' | 'MEMBER';
  team: 'MEDIA' | null;
  discord_id: string | null;
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

export interface Task {
  id: number;
  event_id: number;
  title: string;
  description: string | null;
  task_type: 'STANDARD' | 'SETUP';
  status: 'PENDING' | 'DONE' | 'CANNOT_DO';
  assigned_to: number | null;
  assigned_team: 'MEDIA' | null;
  assignee_name: string | null;
  reminder_time: string | null;
  reminder_sent: boolean;
  cannot_do_reason: string | null;
}

export interface DashboardData {
  semester: Semester | null;
  weeks: DashboardWeek[];
  current_week_id: number | null;
}

export interface DashboardWeek extends Week {
  events: DashboardEvent[];
}

export interface DashboardEvent extends Event {
  tasks: Task[];
}
