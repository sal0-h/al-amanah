"""
Tests for task endpoints including status changes and permissions.
"""
import pytest
from app.models import TaskAssignment, TaskStatus


class TestListTasks:
    """Test GET /api/events/{id}/tasks endpoint."""
    
    def test_list_tasks(self, admin_client, task, event):
        """List tasks for an event."""
        response = admin_client.get(f"/api/events/{event.id}/tasks")
        assert response.status_code == 200
        tasks = response.json()
        assert len(tasks) >= 1
        assert tasks[0]["title"] == "Test Task"
    
    def test_list_tasks_nonexistent_event(self, admin_client):
        """Listing tasks for non-existent event returns 404."""
        response = admin_client.get("/api/events/9999/tasks")
        assert response.status_code == 404


class TestCreateTask:
    """Test POST /api/events/{id}/tasks endpoint."""
    
    def test_create_task(self, admin_client, event, member_user):
        """Admin can create a task."""
        response = admin_client.post(f"/api/events/{event.id}/tasks", json={
            "title": "New Task",
            "description": "Task description",
            "task_type": "STANDARD",
            "assigned_to": member_user.id
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Task"
        assert data["status"] == "PENDING"
        assert data["assigned_to"] == member_user.id
    
    def test_create_setup_task(self, admin_client, event):
        """Can create a SETUP type task."""
        response = admin_client.post(f"/api/events/{event.id}/tasks", json={
            "title": "Setup Task",
            "task_type": "SETUP"
        })
        assert response.status_code == 200
        assert response.json()["task_type"] == "SETUP"
    
    def test_create_task_with_team(self, admin_client, event, team):
        """Can create task assigned to team."""
        response = admin_client.post(f"/api/events/{event.id}/tasks", json={
            "title": "Team Task",
            "task_type": "STANDARD",
            "assigned_team_id": team.id
        })
        assert response.status_code == 200
        data = response.json()
        assert data["assigned_team_id"] == team.id
        assert "Team" in data["assignee_name"]
    
    def test_create_task_with_multi_users(self, admin_client, event, member_user, admin_user):
        """Can create task with multiple user pool."""
        response = admin_client.post(f"/api/events/{event.id}/tasks", json={
            "title": "Pool Task",
            "task_type": "STANDARD",
            "assigned_user_ids": [member_user.id, admin_user.id]
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["assignees"]) == 2
    
    def test_create_task_as_member(self, member_client, event):
        """Non-admin cannot create tasks."""
        response = member_client.post(f"/api/events/{event.id}/tasks", json={
            "title": "Forbidden Task",
            "task_type": "STANDARD"
        })
        assert response.status_code == 403


class TestUpdateTask:
    """Test PUT /api/tasks/{id} endpoint."""
    
    def test_update_task_title(self, admin_client, task):
        """Admin can update task title."""
        response = admin_client.put(f"/api/tasks/{task.id}", json={
            "title": "Updated Title"
        })
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"
    
    def test_update_task_reassign(self, admin_client, task, admin_user):
        """Reassigning task resets status to PENDING."""
        # First mark as done
        admin_client.patch(f"/api/tasks/{task.id}/done")
        
        # Then reassign
        response = admin_client.put(f"/api/tasks/{task.id}", json={
            "assigned_to": admin_user.id
        })
        assert response.status_code == 200
        assert response.json()["status"] == "PENDING"
        assert response.json()["assigned_to"] == admin_user.id
    
    def test_update_task_as_member(self, member_client, task):
        """Non-admin cannot update tasks."""
        response = member_client.put(f"/api/tasks/{task.id}", json={
            "title": "Hacked Title"
        })
        assert response.status_code == 403


class TestDeleteTask:
    """Test DELETE /api/tasks/{id} endpoint."""
    
    def test_delete_task(self, admin_client, task):
        """Admin can delete a task."""
        response = admin_client.delete(f"/api/tasks/{task.id}")
        assert response.status_code == 200
    
    def test_delete_nonexistent_task(self, admin_client):
        """Deleting non-existent task returns 404."""
        response = admin_client.delete("/api/tasks/9999")
        assert response.status_code == 404
    
    def test_delete_task_as_member(self, member_client, task):
        """Non-admin cannot delete tasks."""
        response = member_client.delete(f"/api/tasks/{task.id}")
        assert response.status_code == 403


class TestMarkTaskDone:
    """Test PATCH /api/tasks/{id}/done endpoint."""
    
    def test_mark_done_as_assignee(self, member_client, task, member_user):
        """Assigned user can mark task as done."""
        response = member_client.patch(f"/api/tasks/{task.id}/done")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "DONE"
        assert data["completed_by"] == member_user.id
    
    def test_mark_done_as_admin(self, admin_client, task, admin_user):
        """Admin can mark any task as done."""
        response = admin_client.patch(f"/api/tasks/{task.id}/done")
        assert response.status_code == 200
        assert response.json()["status"] == "DONE"
        assert response.json()["completed_by"] == admin_user.id
    
    def test_mark_done_as_team_member(self, db_session, team_member_client, event, team, team_member):
        """Team member can mark team-assigned task as done."""
        from app.models import Task, TaskType, TaskStatus
        
        team_task = Task(
            event_id=event.id,
            title="Team Task",
            task_type=TaskType.STANDARD,
            status=TaskStatus.PENDING,
            assigned_team_id=team.id
        )
        db_session.add(team_task)
        db_session.commit()
        db_session.refresh(team_task)
        
        response = team_member_client.patch(f"/api/tasks/{team_task.id}/done")
        assert response.status_code == 200
        assert response.json()["status"] == "DONE"
        assert response.json()["completed_by"] == team_member.id
    
    def test_mark_done_as_pool_member(self, db_session, member_client, event, member_user):
        """Pool member can mark pool-assigned task as done."""
        from app.models import Task, TaskType, TaskStatus, TaskAssignment
        
        pool_task = Task(
            event_id=event.id,
            title="Pool Task",
            task_type=TaskType.STANDARD,
            status=TaskStatus.PENDING
        )
        db_session.add(pool_task)
        db_session.flush()
        
        assignment = TaskAssignment(task_id=pool_task.id, user_id=member_user.id)
        db_session.add(assignment)
        db_session.commit()
        db_session.refresh(pool_task)
        
        response = member_client.patch(f"/api/tasks/{pool_task.id}/done")
        assert response.status_code == 200
        assert response.json()["status"] == "DONE"
    
    def test_mark_done_unauthorized(self, db_session, member_client, event, admin_user):
        """Unassigned user cannot mark task as done."""
        from app.models import Task, TaskType, TaskStatus
        
        other_task = Task(
            event_id=event.id,
            title="Other Task",
            task_type=TaskType.STANDARD,
            status=TaskStatus.PENDING,
            assigned_to=admin_user.id  # Assigned to admin, not member
        )
        db_session.add(other_task)
        db_session.commit()
        db_session.refresh(other_task)
        
        response = member_client.patch(f"/api/tasks/{other_task.id}/done")
        assert response.status_code == 403


class TestMarkTaskCannotDo:
    """Test PATCH /api/tasks/{id}/cannot-do endpoint."""
    
    def test_cannot_do_with_reason(self, member_client, task, member_user):
        """Assignee can flag task as cannot do with reason."""
        response = member_client.patch(f"/api/tasks/{task.id}/cannot-do", json={
            "reason": "Equipment not available"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "CANNOT_DO"
        assert data["cannot_do_reason"] == "Equipment not available"
        assert data["completed_by"] == member_user.id
    
    def test_cannot_do_requires_reason(self, member_client, task):
        """Cannot do without reason fails validation."""
        response = member_client.patch(f"/api/tasks/{task.id}/cannot-do", json={})
        assert response.status_code == 422
    
    def test_cannot_do_unauthorized(self, db_session, member_client, event, admin_user):
        """Unassigned user cannot flag task."""
        from app.models import Task, TaskType, TaskStatus
        
        other_task = Task(
            event_id=event.id,
            title="Other Task",
            task_type=TaskType.STANDARD,
            status=TaskStatus.PENDING,
            assigned_to=admin_user.id
        )
        db_session.add(other_task)
        db_session.commit()
        
        response = member_client.patch(f"/api/tasks/{other_task.id}/cannot-do", json={
            "reason": "Trying to flag someone else's task"
        })
        assert response.status_code == 403


class TestUndoTaskStatus:
    """Test PATCH /api/tasks/{id}/undo endpoint."""
    
    def test_undo_done_task(self, member_client, task):
        """Can undo a completed task."""
        # First mark as done
        member_client.patch(f"/api/tasks/{task.id}/done")
        
        # Then undo
        response = member_client.patch(f"/api/tasks/{task.id}/undo")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["completed_by"] is None
    
    def test_undo_cannot_do_task(self, member_client, task):
        """Can undo a cannot-do task."""
        # First mark as cannot do
        member_client.patch(f"/api/tasks/{task.id}/cannot-do", json={
            "reason": "Test reason"
        })
        
        # Then undo
        response = member_client.patch(f"/api/tasks/{task.id}/undo")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["cannot_do_reason"] is None


class TestSendTaskReminder:
    """Test POST /api/tasks/{id}/send-reminder endpoint."""
    
    def test_send_reminder_admin_only(self, admin_client, task):
        """Only admin can send reminders."""
        response = admin_client.post(f"/api/tasks/{task.id}/send-reminder")
        # Should succeed (may fail if no Discord URL configured, but shouldn't be 403)
        assert response.status_code in [200, 400]  # 400 if no Discord ID
    
    def test_send_reminder_as_member(self, member_client, task):
        """Non-admin cannot send reminders."""
        response = member_client.post(f"/api/tasks/{task.id}/send-reminder")
        assert response.status_code == 403
