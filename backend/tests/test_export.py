"""
Tests for export/import endpoints.
"""
import pytest
from datetime import date, datetime, timedelta


class TestExportSemester:
    """Test GET /api/export/semester/{id} endpoint."""
    
    def test_export_semester(self, admin_client, semester, week, event, task):
        """Export a single semester."""
        response = admin_client.get(f"/api/export/semester/{semester.id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "exported_at" in data
        assert "version" in data
        assert "semesters" in data
        assert len(data["semesters"]) == 1
        
        sem_data = data["semesters"][0]
        assert sem_data["name"] == semester.name
        assert "weeks" in sem_data
    
    def test_export_includes_hierarchy(self, admin_client, semester, week, event, task):
        """Export includes full hierarchy."""
        response = admin_client.get(f"/api/export/semester/{semester.id}")
        data = response.json()
        
        sem = data["semesters"][0]
        assert len(sem["weeks"]) >= 1
        
        week_data = sem["weeks"][0]
        assert len(week_data["events"]) >= 1
        
        event_data = week_data["events"][0]
        assert len(event_data["tasks"]) >= 1
    
    def test_export_nonexistent_semester(self, admin_client):
        """Exporting non-existent semester returns 404."""
        response = admin_client.get("/api/export/semester/9999")
        assert response.status_code == 404
    
    def test_export_as_member(self, member_client, semester):
        """Non-admin cannot export."""
        response = member_client.get(f"/api/export/semester/{semester.id}")
        assert response.status_code == 403


class TestExportAll:
    """Test GET /api/export/all endpoint."""
    
    def test_export_all(self, admin_client, semester, week, event, task):
        """Export all semesters."""
        response = admin_client.get("/api/export/all")
        assert response.status_code == 200
        data = response.json()
        
        assert "semesters" in data
        assert len(data["semesters"]) >= 1
    
    def test_export_all_multiple_semesters(self, admin_client, db_session, semester):
        """Export includes multiple semesters."""
        from app.models import Semester
        
        sem2 = Semester(
            name="Fall 2025",
            start_date=date.today() - timedelta(days=200),
            end_date=date.today() - timedelta(days=80),
            is_active=False
        )
        db_session.add(sem2)
        db_session.commit()
        
        response = admin_client.get("/api/export/all")
        data = response.json()
        
        assert len(data["semesters"]) >= 2


class TestImportData:
    """Test POST /api/export/import endpoint."""
    
    def test_import_data(self, admin_client):
        """Import semester data."""
        import_data = {
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "semesters": [{
                "name": "Imported Semester",
                "start_date": "2027-01-01",
                "end_date": "2027-05-01",
                "is_active": False,
                "roster_usernames": [],
                "weeks": [{
                    "week_number": 1,
                    "start_date": "2027-01-06",
                    "end_date": "2027-01-12",
                    "events": [{
                        "name": "Imported Event",
                        "datetime": "2027-01-08T18:00:00",
                        "location": "Imported Location",
                        "tasks": [{
                            "title": "Imported Task",
                            "description": None,
                            "task_type": "STANDARD",
                            "status": "PENDING",
                            "assigned_to_username": None,
                            "assigned_team_name": None,
                            "completed_by_username": None,
                            "cannot_do_reason": None
                        }]
                    }]
                }]
            }]
        }
        
        response = admin_client.post("/api/export/import", json=import_data)
        assert response.status_code == 200
        result = response.json()
        
        assert result["semesters_created"] >= 1
        assert result["weeks_created"] >= 1
        assert result["events_created"] >= 1
        assert result["tasks_created"] >= 1
    
    def test_import_skip_existing(self, admin_client, semester):
        """Import skips existing semesters."""
        import_data = {
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "semesters": [{
                "name": semester.name,  # Same name as existing
                "start_date": semester.start_date.isoformat(),
                "end_date": semester.end_date.isoformat(),
                "is_active": False,
                "roster_usernames": [],
                "weeks": []
            }]
        }
        
        response = admin_client.post("/api/export/import?skip_existing=true", json=import_data)
        assert response.status_code == 200
        result = response.json()
        
        # Should be skipped
        assert result["semesters_created"] == 0
    
    def test_import_as_member(self, member_client):
        """Non-admin cannot import."""
        import_data = {
            "exported_at": datetime.now().isoformat(),
            "version": "1.0.0",
            "semesters": []
        }
        
        response = member_client.post("/api/export/import", json=import_data)
        assert response.status_code == 403
    
    def test_import_invalid_data(self, admin_client):
        """Import with invalid data returns error."""
        response = admin_client.post("/api/export/import", json={
            "invalid": "data"
        })
        assert response.status_code == 422
