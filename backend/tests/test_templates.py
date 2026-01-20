"""
Tests for template endpoints.
"""
import pytest
from datetime import datetime, timedelta


class TestGetEventTemplates:
    """Test GET /api/templates/events endpoint."""
    
    def test_get_event_templates(self, admin_client):
        """Get all event templates including defaults."""
        response = admin_client.get("/api/templates/events")
        assert response.status_code == 200
        templates = response.json()
        
        # Should have default templates
        template_ids = [t["id"] for t in templates]
        assert "jumuah" in template_ids
        assert "halaqa" in template_ids
        assert "sweet_sunday" in template_ids
        assert "kk" in template_ids
        assert "custom" in template_ids
    
    def test_templates_have_tasks(self, admin_client):
        """Templates include task definitions."""
        response = admin_client.get("/api/templates/events")
        templates = response.json()
        
        jumuah = next(t for t in templates if t["id"] == "jumuah")
        assert len(jumuah["tasks"]) > 0
        assert any(t["title"] for t in jumuah["tasks"])
    
    def test_get_templates_as_member(self, member_client):
        """Non-admin cannot access templates."""
        response = member_client.get("/api/templates/events")
        assert response.status_code == 403


class TestCreateEventTemplate:
    """Test POST /api/templates/events endpoint."""
    
    def test_create_custom_template(self, admin_client):
        """Admin can create custom event template."""
        response = admin_client.post("/api/templates/events", json={
            "name": "Custom Meeting",
            "default_location": "Room 101",
            "tasks": [
                {"title": "Prepare agenda", "task_type": "STANDARD"},
                {"title": "Book room", "task_type": "SETUP"}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Meeting"
        assert data["is_custom"] == True
        assert data["id"].startswith("db_")
        assert len(data["tasks"]) == 2
    
    def test_create_template_without_tasks(self, admin_client):
        """Can create template without tasks."""
        response = admin_client.post("/api/templates/events", json={
            "name": "Empty Template"
        })
        assert response.status_code == 200
        assert len(response.json()["tasks"]) == 0
    
    def test_cannot_duplicate_default_name(self, admin_client):
        """Cannot create template with same name as default."""
        response = admin_client.post("/api/templates/events", json={
            "name": "Jumuah Prayer"  # Same as default
        })
        assert response.status_code == 400
    
    def test_create_template_as_member(self, member_client):
        """Non-admin cannot create templates."""
        response = member_client.post("/api/templates/events", json={
            "name": "Forbidden Template"
        })
        assert response.status_code == 403


class TestUpdateEventTemplate:
    """Test PUT /api/templates/events/{id} endpoint."""
    
    def test_update_custom_template(self, admin_client):
        """Admin can update custom template."""
        # First create a custom template
        create_response = admin_client.post("/api/templates/events", json={
            "name": "Updateable Template"
        })
        template_id = int(create_response.json()["id"].replace("db_", ""))
        
        # Update it
        response = admin_client.put(f"/api/templates/events/{template_id}", json={
            "name": "Updated Template Name",
            "default_location": "New Location"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Template Name"
    
    def test_update_nonexistent_template(self, admin_client):
        """Updating non-existent template returns 404."""
        response = admin_client.put("/api/templates/events/9999", json={
            "name": "Ghost Template"
        })
        assert response.status_code == 404


class TestDeleteEventTemplate:
    """Test DELETE /api/templates/events/{id} endpoint."""
    
    def test_delete_custom_template(self, admin_client):
        """Admin can delete custom template."""
        # First create
        create_response = admin_client.post("/api/templates/events", json={
            "name": "Deleteable Template"
        })
        template_id = int(create_response.json()["id"].replace("db_", ""))
        
        # Delete
        response = admin_client.delete(f"/api/templates/events/{template_id}")
        assert response.status_code == 200
    
    def test_delete_nonexistent_template(self, admin_client):
        """Deleting non-existent template returns 404."""
        response = admin_client.delete("/api/templates/events/9999")
        assert response.status_code == 404


class TestCreateFromTemplate:
    """Test POST /api/templates/create endpoint."""
    
    def test_create_event_from_template(self, admin_client, week, team, db_session):
        """Create event from template."""
        # Ensure Media team exists for template tasks
        from app.models import Team
        media = db_session.query(Team).filter(Team.name == "Media").first()
        if not media:
            media = Team(name="Media")
            db_session.add(media)
            db_session.commit()
        
        event_time = (datetime.now() + timedelta(days=1)).isoformat()
        
        response = admin_client.post("/api/templates/create", json={
            "template_id": "jumuah",
            "week_id": week.id,
            "datetime": event_time,
            "location": "Custom Mosque"
        })
        assert response.status_code == 200
        data = response.json()
        assert "event_id" in data
        assert "Jumuah" in data["message"] or "tasks" in data["message"]
    
    def test_create_with_custom_name(self, admin_client, week):
        """Create event from template with custom name."""
        event_time = (datetime.now() + timedelta(days=2)).isoformat()
        
        response = admin_client.post("/api/templates/create", json={
            "template_id": "halaqa",
            "week_id": week.id,
            "datetime": event_time,
            "event_name": "Special Halaqa"
        })
        assert response.status_code == 200
    
    def test_create_from_nonexistent_template(self, admin_client, week):
        """Creating from non-existent template returns 404."""
        event_time = (datetime.now() + timedelta(days=1)).isoformat()
        
        response = admin_client.post("/api/templates/create", json={
            "template_id": "nonexistent",
            "week_id": week.id,
            "datetime": event_time
        })
        assert response.status_code == 404
    
    def test_create_from_template_as_member(self, member_client, week):
        """Non-admin cannot create from template."""
        event_time = (datetime.now() + timedelta(days=1)).isoformat()
        
        response = member_client.post("/api/templates/create", json={
            "template_id": "jumuah",
            "week_id": week.id,
            "datetime": event_time
        })
        assert response.status_code == 403


class TestWeekTemplates:
    """Test /api/templates/weeks endpoints."""
    
    def test_get_week_templates(self, admin_client):
        """Get all week templates."""
        response = admin_client.get("/api/templates/weeks")
        assert response.status_code == 200
        templates = response.json()
        
        # Should have default week templates
        template_ids = [t["id"] for t in templates]
        assert "sweet_sunday_kk" in template_ids
    
    def test_week_template_has_events(self, admin_client):
        """Week templates include event configurations."""
        response = admin_client.get("/api/templates/weeks")
        templates = response.json()
        
        ss_kk = next(t for t in templates if t["id"] == "sweet_sunday_kk")
        assert len(ss_kk["events"]) >= 2
        assert any(e["event_template_id"] == "sweet_sunday" for e in ss_kk["events"])
    
    def test_create_week_template(self, admin_client):
        """Admin can create custom week template."""
        response = admin_client.post("/api/templates/weeks", json={
            "name": "Custom Week",
            "description": "A custom week pattern",
            "events": [
                {"event_template_id": "jumuah", "day_of_week": 4, "default_time": "12:30"},
                {"event_template_id": "halaqa", "day_of_week": 2, "default_time": "18:00"}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Week"
        assert data["is_custom"] == True
        assert len(data["events"]) == 2
    
    def test_create_from_week_template(self, admin_client, week):
        """Create events from week template."""
        response = admin_client.post("/api/templates/weeks/create", json={
            "week_template_id": "jumuah_halaqa",
            "week_id": week.id
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) >= 2
