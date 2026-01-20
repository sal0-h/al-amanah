"""
Tests for semester, week, and event endpoints.
"""
import pytest
from datetime import date, datetime, timedelta


class TestSemesters:
    """Test /api/semesters endpoints."""
    
    def test_list_semesters(self, admin_client, semester):
        """List all semesters."""
        response = admin_client.get("/api/semesters")
        assert response.status_code == 200
        semesters = response.json()
        assert len(semesters) >= 1
        assert semesters[0]["name"] == "Spring 2026"
    
    def test_create_semester(self, admin_client):
        """Admin can create a semester."""
        response = admin_client.post("/api/semesters", json={
            "name": "Fall 2026",
            "start_date": "2026-08-20",
            "end_date": "2026-12-15",
            "is_active": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Fall 2026"
        assert data["is_active"] == False
    
    def test_single_active_semester(self, admin_client, semester):
        """Creating active semester deactivates others."""
        # semester is already active
        response = admin_client.post("/api/semesters", json={
            "name": "New Active",
            "start_date": "2026-06-01",
            "end_date": "2026-08-15",
            "is_active": True
        })
        assert response.status_code == 200
        
        # Check original semester is now inactive
        list_response = admin_client.get("/api/semesters")
        semesters = list_response.json()
        active_count = sum(1 for s in semesters if s["is_active"])
        assert active_count == 1
    
    def test_update_semester(self, admin_client, semester):
        """Admin can update a semester."""
        response = admin_client.put(f"/api/semesters/{semester.id}", json={
            "name": "Updated Semester"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Semester"
    
    def test_activate_semester(self, admin_client, db_session):
        """Activating a semester deactivates others."""
        from app.models import Semester
        
        # Create two inactive semesters
        sem1 = Semester(
            name="Sem 1", 
            start_date=date.today(), 
            end_date=date.today() + timedelta(days=60),
            is_active=False
        )
        sem2 = Semester(
            name="Sem 2", 
            start_date=date.today() + timedelta(days=70), 
            end_date=date.today() + timedelta(days=130),
            is_active=False
        )
        db_session.add_all([sem1, sem2])
        db_session.commit()
        
        # Activate sem2
        response = admin_client.put(f"/api/semesters/{sem2.id}", json={
            "is_active": True
        })
        assert response.status_code == 200
        
        # Check only sem2 is active
        list_response = admin_client.get("/api/semesters")
        semesters = list_response.json()
        active_sems = [s for s in semesters if s["is_active"]]
        assert len(active_sems) == 1
        assert active_sems[0]["name"] == "Sem 2"
    
    def test_delete_semester(self, admin_client, semester):
        """Admin can delete a semester."""
        response = admin_client.delete(f"/api/semesters/{semester.id}")
        assert response.status_code == 200
    
    def test_semester_crud_as_member(self, member_client, semester):
        """Non-admin cannot modify semesters."""
        # Can read
        response = member_client.get("/api/semesters")
        assert response.status_code == 200
        
        # Cannot create
        response = member_client.post("/api/semesters", json={
            "name": "Forbidden",
            "start_date": "2026-01-01",
            "end_date": "2026-05-01"
        })
        assert response.status_code == 403
        
        # Cannot update
        response = member_client.put(f"/api/semesters/{semester.id}", json={
            "name": "Hacked"
        })
        assert response.status_code == 403
        
        # Cannot delete
        response = member_client.delete(f"/api/semesters/{semester.id}")
        assert response.status_code == 403


class TestWeeks:
    """Test /api/semesters/{id}/weeks and /api/weeks endpoints."""
    
    def test_list_weeks(self, admin_client, semester, week):
        """List weeks in a semester."""
        response = admin_client.get(f"/api/semesters/{semester.id}/weeks")
        assert response.status_code == 200
        weeks = response.json()
        assert len(weeks) >= 1
        assert weeks[0]["week_number"] == 1
    
    def test_create_week(self, admin_client, semester):
        """Admin can create a week."""
        start = date.today() + timedelta(days=7)
        end = start + timedelta(days=6)
        
        response = admin_client.post(f"/api/semesters/{semester.id}/weeks", json={
            "week_number": 2,
            "start_date": start.isoformat(),
            "end_date": end.isoformat()
        })
        assert response.status_code == 200
        data = response.json()
        assert data["week_number"] == 2
    
    def test_update_week(self, admin_client, week):
        """Admin can update a week."""
        response = admin_client.put(f"/api/weeks/{week.id}", json={
            "week_number": 10
        })
        assert response.status_code == 200
        assert response.json()["week_number"] == 10
    
    def test_delete_week(self, admin_client, week):
        """Admin can delete a week."""
        response = admin_client.delete(f"/api/weeks/{week.id}")
        assert response.status_code == 200
    
    def test_week_crud_as_member(self, member_client, semester, week):
        """Non-admin cannot modify weeks."""
        response = member_client.post(f"/api/semesters/{semester.id}/weeks", json={
            "week_number": 99,
            "start_date": "2026-12-01",
            "end_date": "2026-12-07"
        })
        assert response.status_code == 403


class TestEvents:
    """Test /api/weeks/{id}/events and /api/events endpoints."""
    
    def test_list_events(self, admin_client, week, event):
        """List events in a week."""
        response = admin_client.get(f"/api/weeks/{week.id}/events")
        assert response.status_code == 200
        events = response.json()
        assert len(events) >= 1
        assert events[0]["name"] == "Test Event"
    
    def test_create_event(self, admin_client, week):
        """Admin can create an event."""
        event_time = (datetime.now() + timedelta(days=2)).isoformat()
        
        response = admin_client.post(f"/api/weeks/{week.id}/events", json={
            "name": "New Event",
            "datetime": event_time,
            "location": "Conference Room"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Event"
        assert data["location"] == "Conference Room"
    
    def test_create_event_without_location(self, admin_client, week):
        """Can create event without location."""
        event_time = (datetime.now() + timedelta(days=3)).isoformat()
        
        response = admin_client.post(f"/api/weeks/{week.id}/events", json={
            "name": "Virtual Event",
            "datetime": event_time
        })
        assert response.status_code == 200
        assert response.json()["location"] is None
    
    def test_update_event(self, admin_client, event):
        """Admin can update an event."""
        response = admin_client.put(f"/api/events/{event.id}", json={
            "name": "Updated Event",
            "location": "New Location"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Event"
        assert data["location"] == "New Location"
    
    def test_delete_event(self, admin_client, event):
        """Admin can delete an event."""
        response = admin_client.delete(f"/api/events/{event.id}")
        assert response.status_code == 200
    
    def test_event_crud_as_member(self, member_client, week, event):
        """Non-admin cannot modify events."""
        response = member_client.post(f"/api/weeks/{week.id}/events", json={
            "name": "Forbidden Event",
            "datetime": datetime.now().isoformat()
        })
        assert response.status_code == 403
        
        response = member_client.put(f"/api/events/{event.id}", json={
            "name": "Hacked Event"
        })
        assert response.status_code == 403
        
        response = member_client.delete(f"/api/events/{event.id}")
        assert response.status_code == 403


class TestSendEventReminders:
    """Test POST /api/events/{id}/send-all-reminders endpoint."""
    
    def test_send_all_reminders_admin_only(self, admin_client, event, task):
        """Only admin can send all reminders."""
        response = admin_client.post(f"/api/events/{event.id}/send-all-reminders")
        # May succeed or fail based on Discord config, but shouldn't be 403
        assert response.status_code in [200, 400]
    
    def test_send_all_reminders_as_member(self, member_client, event):
        """Non-admin cannot send all reminders."""
        response = member_client.post(f"/api/events/{event.id}/send-all-reminders")
        assert response.status_code == 403
