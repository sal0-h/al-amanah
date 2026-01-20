"""
Tests for dashboard endpoint.
"""
import pytest
from datetime import date, datetime, timedelta
from app.models import Task, TaskType, TaskStatus, RosterMember, TaskAssignment


class TestDashboard:
    """Test GET /api/dashboard endpoint."""
    
    def test_dashboard_with_active_semester(self, admin_client, semester, week, event, task):
        """Dashboard returns data for active semester."""
        response = admin_client.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert data["semester_name"] == "Spring 2026"
        assert data["semester_id"] == semester.id
        assert len(data["weeks"]) >= 1
        assert data["user_role"] == "ADMIN"
    
    def test_dashboard_no_active_semester(self, admin_client, db_session, semester):
        """Dashboard with no active semester returns empty."""
        # Deactivate the semester
        semester.is_active = False
        db_session.commit()
        
        response = admin_client.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert data["semester_name"] is None
        assert data["weeks"] == []
    
    def test_dashboard_week_structure(self, admin_client, semester, week, event, task):
        """Dashboard weeks contain correct event/task structure."""
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        week_data = data["weeks"][0]
        assert "week_number" in week_data
        assert "start_date" in week_data
        assert "end_date" in week_data
        assert "is_current" in week_data
        assert "events" in week_data
        
        if week_data["events"]:
            event_data = week_data["events"][0]
            assert "id" in event_data
            assert "name" in event_data
            assert "datetime" in event_data
            assert "tasks" in event_data
    
    def test_dashboard_current_week(self, admin_client, semester, week):
        """Dashboard marks current week correctly."""
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        # Week fixture is created with today's date, so should be current
        current_weeks = [w for w in data["weeks"] if w["is_current"]]
        assert len(current_weeks) == 1
    
    def test_dashboard_unauthenticated(self, client):
        """Unauthenticated access returns 401."""
        response = client.get("/api/dashboard")
        assert response.status_code == 401


class TestDashboardFiltering:
    """Test role-based task filtering in dashboard."""
    
    def test_admin_sees_all_tasks(self, admin_client, db_session, event, member_user, admin_user):
        """Admin sees all tasks regardless of assignment."""
        # Create tasks assigned to different users
        t1 = Task(event_id=event.id, title="Member Task", 
                  task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                  assigned_to=member_user.id)
        t2 = Task(event_id=event.id, title="Admin Task",
                  task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                  assigned_to=admin_user.id)
        t3 = Task(event_id=event.id, title="Unassigned Task",
                  task_type=TaskType.STANDARD, status=TaskStatus.PENDING)
        
        db_session.add_all([t1, t2, t3])
        db_session.commit()
        
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        all_tasks = []
        for week in data["weeks"]:
            for evt in week["events"]:
                all_tasks.extend(evt["tasks"])
        
        task_titles = [t["title"] for t in all_tasks]
        assert "Member Task" in task_titles
        assert "Admin Task" in task_titles
        assert "Unassigned Task" in task_titles
    
    def test_member_sees_only_assigned_tasks(self, member_client, db_session, 
                                              semester, week, event, 
                                              member_user, admin_user):
        """Member only sees tasks assigned to them."""
        # Add member to roster first
        rm = RosterMember(semester_id=semester.id, user_id=member_user.id)
        db_session.add(rm)
        
        t1 = Task(event_id=event.id, title="My Task",
                  task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                  assigned_to=member_user.id)
        t2 = Task(event_id=event.id, title="Not My Task",
                  task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                  assigned_to=admin_user.id)
        
        db_session.add_all([t1, t2])
        db_session.commit()
        
        response = member_client.get("/api/dashboard")
        data = response.json()
        
        all_tasks = []
        for week in data["weeks"]:
            for evt in week["events"]:
                all_tasks.extend(evt["tasks"])
        
        task_titles = [t["title"] for t in all_tasks]
        assert "My Task" in task_titles
        assert "Not My Task" not in task_titles
    
    def test_team_member_sees_team_tasks(self, team_member_client, db_session,
                                         semester, week, event, team, team_member):
        """Team member sees team-assigned tasks."""
        # Add to roster
        rm = RosterMember(semester_id=semester.id, user_id=team_member.id)
        db_session.add(rm)
        
        team_task = Task(event_id=event.id, title="Team Task",
                         task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                         assigned_team_id=team.id)
        
        db_session.add(team_task)
        db_session.commit()
        
        response = team_member_client.get("/api/dashboard")
        data = response.json()
        
        all_tasks = []
        for week in data["weeks"]:
            for evt in week["events"]:
                all_tasks.extend(evt["tasks"])
        
        task_titles = [t["title"] for t in all_tasks]
        assert "Team Task" in task_titles
    
    def test_pool_member_sees_pool_tasks(self, member_client, db_session,
                                          semester, week, event, member_user):
        """Pool member sees tasks they're in the pool for."""
        # Add to roster
        rm = RosterMember(semester_id=semester.id, user_id=member_user.id)
        db_session.add(rm)
        db_session.flush()
        
        pool_task = Task(event_id=event.id, title="Pool Task",
                         task_type=TaskType.STANDARD, status=TaskStatus.PENDING)
        db_session.add(pool_task)
        db_session.flush()
        
        assignment = TaskAssignment(task_id=pool_task.id, user_id=member_user.id)
        db_session.add(assignment)
        db_session.commit()
        
        response = member_client.get("/api/dashboard")
        data = response.json()
        
        all_tasks = []
        for week in data["weeks"]:
            for evt in week["events"]:
                all_tasks.extend(evt["tasks"])
        
        task_titles = [t["title"] for t in all_tasks]
        assert "Pool Task" in task_titles
    
    def test_non_roster_member_sees_empty(self, member_client, semester, week, event, task):
        """User not in roster sees empty dashboard."""
        # member_user is NOT added to roster in this test
        response = member_client.get("/api/dashboard")
        data = response.json()
        
        # Should see semester name but no weeks/events
        assert data["semester_name"] == "Spring 2026"
        assert data["weeks"] == []


class TestDashboardTaskData:
    """Test task data completeness in dashboard."""
    
    def test_task_includes_assignee_info(self, admin_client, task, member_user):
        """Task includes assignee name."""
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        task_data = None
        for week in data["weeks"]:
            for evt in week["events"]:
                for t in evt["tasks"]:
                    if t["id"] == task.id:
                        task_data = t
                        break
        
        assert task_data is not None
        assert task_data["assignee_name"] == member_user.display_name
    
    def test_task_includes_completion_info(self, admin_client, db_session, task, member_user):
        """Completed task shows who completed it."""
        task.status = TaskStatus.DONE
        task.completed_by = member_user.id
        db_session.commit()
        
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        task_data = None
        for week in data["weeks"]:
            for evt in week["events"]:
                for t in evt["tasks"]:
                    if t["id"] == task.id:
                        task_data = t
                        break
        
        assert task_data is not None
        assert task_data["completed_by"] == member_user.id
        assert task_data["completed_by_name"] == member_user.display_name
    
    def test_team_task_shows_team_name(self, admin_client, db_session, event, team):
        """Team-assigned task shows team name."""
        team_task = Task(event_id=event.id, title="Team Task",
                         task_type=TaskType.STANDARD, status=TaskStatus.PENDING,
                         assigned_team_id=team.id)
        db_session.add(team_task)
        db_session.commit()
        
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        task_data = None
        for week in data["weeks"]:
            for evt in week["events"]:
                for t in evt["tasks"]:
                    if t["title"] == "Team Task":
                        task_data = t
                        break
        
        assert task_data is not None
        assert "Team" in task_data["assignee_name"]
    
    def test_multi_assignee_shows_count(self, admin_client, db_session, event, member_user, admin_user):
        """Multi-assigned task shows assignee count."""
        pool_task = Task(event_id=event.id, title="Multi Task",
                         task_type=TaskType.STANDARD, status=TaskStatus.PENDING)
        db_session.add(pool_task)
        db_session.flush()
        
        a1 = TaskAssignment(task_id=pool_task.id, user_id=member_user.id)
        a2 = TaskAssignment(task_id=pool_task.id, user_id=admin_user.id)
        db_session.add_all([a1, a2])
        db_session.commit()
        
        response = admin_client.get("/api/dashboard")
        data = response.json()
        
        task_data = None
        for week in data["weeks"]:
            for evt in week["events"]:
                for t in evt["tasks"]:
                    if t["title"] == "Multi Task":
                        task_data = t
                        break
        
        assert task_data is not None
        assert "2 people" in task_data["assignee_name"]
        assert len(task_data["assignees"]) == 2
