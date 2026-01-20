"""
Tests for statistics endpoints.
"""
import pytest
from datetime import date, datetime, timedelta
from app.models import Task, TaskType, TaskStatus


class TestOverviewStats:
    """Test GET /api/stats/overview endpoint."""
    
    def test_overview_stats(self, admin_client, semester, week, event, task):
        """Get overview statistics."""
        response = admin_client.get("/api/stats/overview")
        assert response.status_code == 200
        data = response.json()
        
        # Match actual API response fields from OverviewStats schema
        assert "total_tasks" in data
        assert "tasks_completed" in data
        assert "tasks_pending" in data
        assert "tasks_cannot_do" in data
        assert "completion_rate" in data
    
    def test_overview_stats_for_semester(self, admin_client, semester, week, event, task):
        """Get overview stats for specific semester."""
        response = admin_client.get(f"/api/stats/overview?semester_id={semester.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["total_tasks"] >= 1
    
    def test_overview_stats_counts(self, admin_client, db_session, event):
        """Verify task counts are accurate."""
        # Create tasks with different statuses
        pending = Task(event_id=event.id, title="Pending",
                       task_type=TaskType.STANDARD, status=TaskStatus.PENDING)
        done = Task(event_id=event.id, title="Done",
                    task_type=TaskType.STANDARD, status=TaskStatus.DONE)
        cannot = Task(event_id=event.id, title="Cannot",
                      task_type=TaskType.STANDARD, status=TaskStatus.CANNOT_DO)
        
        db_session.add_all([pending, done, cannot])
        db_session.commit()
        
        response = admin_client.get("/api/stats/overview")
        data = response.json()
        
        assert data["total_tasks"] >= 3
        assert data["tasks_completed"] >= 1
        assert data["tasks_pending"] >= 1
        assert data["tasks_cannot_do"] >= 1
    
    def test_overview_as_admin_only(self, member_client):
        """Stats overview requires admin access."""
        response = member_client.get("/api/stats/overview")
        assert response.status_code == 403  # Admin only endpoint


class TestUserStats:
    """Test GET /api/stats/users endpoint."""
    
    def test_user_stats(self, admin_client, semester, week, event, task, member_user):
        """Get per-user statistics."""
        response = admin_client.get("/api/stats/users")
        assert response.status_code == 200
        stats = response.json()
        
        assert isinstance(stats, list)
        if stats:
            user_stat = stats[0]
            assert "user_id" in user_stat
            assert "display_name" in user_stat
            # Match actual API response fields from UserStats schema
            assert "tasks_assigned" in user_stat
            assert "tasks_completed" in user_stat
    
    def test_user_stats_for_semester(self, admin_client, semester, week, event, task, member_user):
        """Get user stats for specific semester."""
        response = admin_client.get(f"/api/stats/users?semester_id={semester.id}")
        assert response.status_code == 200
        stats = response.json()
        
        # Find member_user in stats
        member_stats = next((s for s in stats if s["user_id"] == member_user.id), None)
        assert member_stats is not None
        assert member_stats["tasks_assigned"] >= 1


class TestTeamStats:
    """Test GET /api/stats/teams endpoint."""
    
    def test_team_stats(self, admin_client, db_session, event, team):
        """Get per-team statistics."""
        # Create team-assigned task
        team_task = Task(event_id=event.id, title="Team Task",
                         task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                         assigned_team_id=team.id)
        db_session.add(team_task)
        db_session.commit()
        
        response = admin_client.get("/api/stats/teams")
        assert response.status_code == 200
        stats = response.json()
        
        assert isinstance(stats, list)
        if stats:
            team_stat = stats[0]
            assert "team_id" in team_stat
            assert "team_name" in team_stat
            # Match actual API response fields from TeamStats schema
            assert "tasks_assigned" in team_stat


class TestSemesterStats:
    """Test GET /api/stats/semesters endpoint."""
    
    def test_semester_stats(self, admin_client, semester, week, event, task):
        """Get per-semester statistics."""
        response = admin_client.get("/api/stats/semesters")
        assert response.status_code == 200
        stats = response.json()
        
        assert isinstance(stats, list)
        if stats:
            sem_stat = stats[0]
            assert "semester_id" in sem_stat
            assert "semester_name" in sem_stat
            # Match actual API response fields from SemesterStats schema
            assert "tasks_count" in sem_stat


class TestWeeklyActivity:
    """Test GET /api/stats/activity endpoint."""
    
    def test_weekly_activity(self, admin_client, semester, week, event, task):
        """Get weekly activity data."""
        response = admin_client.get(f"/api/stats/activity?semester_id={semester.id}")
        assert response.status_code == 200
        activity = response.json()
        
        assert isinstance(activity, list)
        if activity:
            week_activity = activity[0]
            assert "week_number" in week_activity
            # Match actual API response fields from WeeklyActivity schema
            assert "tasks_created" in week_activity
            assert "tasks_completed" in week_activity


class TestActiveSemester:
    """Test GET /api/stats/active-semester endpoint."""
    
    def test_active_semester_info(self, admin_client, semester):
        """Get active semester info."""
        response = admin_client.get("/api/stats/active-semester")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == semester.id
        assert data["name"] == semester.name
    
    def test_no_active_semester(self, admin_client, db_session, semester):
        """Response when no active semester."""
        semester.is_active = False
        db_session.commit()
        
        response = admin_client.get("/api/stats/active-semester")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] is None
        assert data["name"] is None
