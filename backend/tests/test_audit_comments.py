"""
Tests for audit log and comments endpoints.
"""
import pytest
from app.models import AuditLog, TaskComment


class TestAuditLogs:
    """Test /api/audit endpoints."""
    
    def test_get_audit_logs(self, admin_client, db_session):
        """Admin can get audit logs."""
        # Create some audit entries
        log1 = AuditLog(
            action="TASK_DONE",
            entity_type="task",
            entity_id=1,
            entity_name="Test Task",
            user_id=1,
            details="Marked task as done"
        )
        log2 = AuditLog(
            action="TASK_UNDO",
            entity_type="task",
            entity_id=1,
            entity_name="Test Task",
            user_id=1,
            details="Reset to PENDING"
        )
        db_session.add_all([log1, log2])
        db_session.commit()
        
        response = admin_client.get("/api/audit")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert len(data["items"]) >= 2
    
    def test_audit_logs_pagination(self, admin_client, db_session):
        """Audit logs support pagination."""
        # Create many entries
        for i in range(15):
            log = AuditLog(
                action="TEST_ACTION",
                entity_type="test",
                entity_id=i,
                entity_name=f"Test {i}",
                user_id=1
            )
            db_session.add(log)
        db_session.commit()
        
        response = admin_client.get("/api/audit?page=1&per_page=10")
        data = response.json()
        
        assert len(data["items"]) == 10
        assert data["total"] >= 15
    
    def test_audit_logs_filter_by_action(self, admin_client, db_session):
        """Can filter audit logs by action."""
        log1 = AuditLog(action="TASK_DONE", entity_type="task", entity_id=1, entity_name="T1", user_id=1)
        log2 = AuditLog(action="TASK_UNDO", entity_type="task", entity_id=2, entity_name="T2", user_id=1)
        db_session.add_all([log1, log2])
        db_session.commit()
        
        response = admin_client.get("/api/audit?action=TASK_DONE")
        data = response.json()
        
        for item in data["items"]:
            assert item["action"] == "TASK_DONE"
    
    def test_audit_logs_filter_by_entity(self, admin_client, db_session):
        """Can filter audit logs by entity type."""
        log1 = AuditLog(action="CREATE", entity_type="task", entity_id=1, entity_name="Task", user_id=1)
        log2 = AuditLog(action="CREATE", entity_type="event", entity_id=1, entity_name="Event", user_id=1)
        db_session.add_all([log1, log2])
        db_session.commit()
        
        response = admin_client.get("/api/audit?entity_type=task")
        data = response.json()
        
        for item in data["items"]:
            assert item["entity_type"] == "task"
    
    def test_audit_logs_as_member(self, member_client):
        """Non-admin cannot access audit logs."""
        response = member_client.get("/api/audit")
        assert response.status_code == 403
    
    def test_get_audit_actions(self, admin_client):
        """Get list of distinct audit actions."""
        response = admin_client.get("/api/audit/actions")
        assert response.status_code == 200
        actions = response.json()
        assert isinstance(actions, list)
    
    def test_get_audit_entities(self, admin_client):
        """Get list of distinct entity types."""
        response = admin_client.get("/api/audit/entities")
        assert response.status_code == 200
        entities = response.json()
        assert isinstance(entities, list)


class TestTaskComments:
    """Test /api/tasks/{id}/comments endpoints."""
    
    def test_get_comments(self, admin_client, task):
        """Get comments for a task."""
        response = admin_client.get(f"/api/tasks/{task.id}/comments")
        assert response.status_code == 200
        comments = response.json()
        assert isinstance(comments, list)
    
    def test_add_comment(self, admin_client, task, admin_user):
        """Add comment to a task."""
        response = admin_client.post(f"/api/tasks/{task.id}/comments", json={
            "content": "This is a test comment"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["content"] == "This is a test comment"
        assert data["user_id"] == admin_user.id
        assert "created_at" in data
    
    def test_add_comment_as_member(self, member_client, task, member_user):
        """Member can add comment to their assigned task."""
        response = member_client.post(f"/api/tasks/{task.id}/comments", json={
            "content": "Member comment"
        })
        assert response.status_code == 200
        assert response.json()["content"] == "Member comment"
    
    def test_delete_comment_as_author(self, admin_client, db_session, task, admin_user):
        """User can delete their own comment."""
        comment = TaskComment(
            task_id=task.id,
            user_id=admin_user.id,
            content="To be deleted"
        )
        db_session.add(comment)
        db_session.commit()
        
        response = admin_client.delete(f"/api/tasks/{task.id}/comments/{comment.id}")
        assert response.status_code == 200
    
    def test_delete_comment_admin(self, admin_client, db_session, task, member_user):
        """Admin can delete any comment."""
        comment = TaskComment(
            task_id=task.id,
            user_id=member_user.id,
            content="Member's comment"
        )
        db_session.add(comment)
        db_session.commit()
        
        response = admin_client.delete(f"/api/tasks/{task.id}/comments/{comment.id}")
        assert response.status_code == 200
    
    def test_get_comments_nonexistent_task(self, admin_client):
        """Getting comments for non-existent task returns 404."""
        response = admin_client.get("/api/tasks/9999/comments")
        assert response.status_code == 404
