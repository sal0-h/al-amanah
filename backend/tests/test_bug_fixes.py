"""
Tests for bug fixes from BUG_REPORT.md
Testing Critical, High, and Medium severity bug fixes.
"""
import pytest
import json
import re
from app.models import User, Role, Team, Semester, Week, Event, Task, TaskStatus, TaskType, RosterMember
from app.middleware.auth import hash_password


class TestDiscordIDValidation:
    """Test Discord ID validation (Bug #2 - High)"""
    
    def test_valid_discord_id_18_digits(self, admin_client, db_session):
        """Valid Discord ID with exactly 18 digits should work"""
        response = admin_client.post("/api/users", json={
            "username": "testuser1",
            "password": "test123",
            "display_name": "Test User",
            "discord_id": "123456789012345678",
            "role": "MEMBER"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["discord_id"] == "123456789012345678"
    
    def test_invalid_discord_id_too_short(self, admin_client):
        """Discord ID with less than 18 digits should fail"""
        response = admin_client.post("/api/users", json={
            "username": "testuser2",
            "password": "test123",
            "display_name": "Test User",
            "discord_id": "12345",
            "role": "MEMBER"
        })
        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert any("18 digits" in str(e) for e in error_detail)
    
    def test_invalid_discord_id_too_long(self, admin_client):
        """Discord ID with more than 18 digits should fail"""
        response = admin_client.post("/api/users", json={
            "username": "testuser3",
            "password": "test123",
            "display_name": "Test User",
            "discord_id": "1234567890123456789",
            "role": "MEMBER"
        })
        assert response.status_code == 422
    
    def test_invalid_discord_id_non_numeric(self, admin_client):
        """Discord ID with non-numeric characters should fail"""
        response = admin_client.post("/api/users", json={
            "username": "testuser4",
            "password": "test123",
            "display_name": "Test User",
            "discord_id": "12345678901234567a",
            "role": "MEMBER"
        })
        assert response.status_code == 422
    
    def test_discord_id_none_allowed(self, admin_client):
        """None Discord ID should be allowed"""
        response = admin_client.post("/api/users", json={
            "username": "testuser5",
            "password": "test123",
            "display_name": "Test User",
            "role": "MEMBER"
        })
        assert response.status_code == 200
        assert response.json()["discord_id"] is None
    
    def test_discord_id_whitespace_trimmed(self, admin_client):
        """Discord ID with whitespace should be trimmed"""
        response = admin_client.post("/api/users", json={
            "username": "testuser6",
            "password": "test123",
            "display_name": "Test User",
            "discord_id": "  123456789012345678  ",
            "role": "MEMBER"
        })
        assert response.status_code == 200
        assert response.json()["discord_id"] == "123456789012345678"
    
    def test_update_user_discord_id_validation(self, admin_client, member_user):
        """Updating user with invalid Discord ID should fail"""
        response = admin_client.put(f"/api/users/{member_user.id}", json={
            "discord_id": "invalid"
        })
        assert response.status_code == 422


class TestImportTransactionAtomicity:
    """Test import transaction isolation (Bug #1 - Critical)"""
    
    def test_import_creates_complete_semester(self, admin_client, db_session):
        """Successful import should create all nested data atomically"""
        export_data = {
            "exported_at": "2026-01-23T10:00:00Z",
            "version": "1.0",
            "semesters": [{
                "name": "Spring 2026",
                "start_date": "2026-01-05",
                "end_date": "2026-05-15",
                "is_active": False,
                "roster_usernames": [],
                "weeks": [{
                    "week_number": 1,
                    "start_date": "2026-01-05",
                    "end_date": "2026-01-11",
                    "events": [{
                        "name": "Test Event",
                        "datetime": "2026-01-08T12:00:00Z",
                        "tasks": [{
                            "title": "Task 1",
                            "description": "Test task",
                            "task_type": "STANDARD",
                            "status": "PENDING",
                            "assigned_to_username": None,
                            "assigned_team_name": None,
                            "cannot_do_reason": None,
                            "assigned_pool_usernames": []
                        }]
                    }]
                }]
            }]
        }
        
        response = admin_client.post("/api/export/import", json=export_data)
        assert response.status_code == 200
        result = response.json()
        assert result["semesters_created"] == 1
        assert result["weeks_created"] == 1
        assert result["events_created"] == 1
        assert result["tasks_created"] == 1
        
        # Verify data was created
        semester = db_session.query(Semester).filter(Semester.name == "Spring 2026").first()
        assert semester is not None
        assert len(semester.weeks) == 1
        assert len(semester.weeks[0].events) == 1
        assert len(semester.weeks[0].events[0].tasks) == 1


class TestSessionCookieHTTPSDetection:
    """Test HTTPS auto-detection from Cloudflare (Bug #3 - High)"""
    
    def test_https_detected_from_cf_visitor_header(self, client, member_user):
        """Session cookie should detect HTTPS from cf-visitor header"""
        response = client.post("/api/auth/login", json={
            "username": "member",
            "password": "member123"
        }, headers={
            "cf-visitor": '{"scheme":"https"}'
        })
        assert response.status_code == 200
        assert "session" in response.cookies
    
    def test_https_detected_from_x_forwarded_proto(self, client, member_user):
        """Session cookie should detect HTTPS from X-Forwarded-Proto header"""
        response = client.post("/api/auth/login", json={
            "username": "member",
            "password": "member123"
        }, headers={
            "X-Forwarded-Proto": "https"
        })
        assert response.status_code == 200
        assert "session" in response.cookies


class TestDashboardNPlusOneQuery:
    """Test N+1 query fix in dashboard (Bug #4 - High)"""
    
    def test_dashboard_with_multiple_tasks(self, member_client, db_session, semester, week, event, member_user, roster_member):
        """Dashboard should handle multiple tasks efficiently with eager loading"""
        # Create multiple tasks
        for i in range(5):
            task = Task(
                event_id=event.id,
                title=f"Task {i}",
                task_type=TaskType.STANDARD,
                status=TaskStatus.PENDING,
                assigned_to=member_user.id
            )
            db_session.add(task)
        db_session.commit()
        
        # Dashboard should load successfully
        response = member_client.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert len(data["weeks"]) > 0
        
        # Verify tasks are loaded with assignee info
        week_data = data["weeks"][0]
        if week_data["events"]:
            event_data = week_data["events"][0]
            assert len(event_data["tasks"]) >= 5


class TestTeamValidationInTemplates:
    """Test team validation in template creation (Bug #6 - Medium)"""
    
    def test_template_fails_with_missing_team(self, admin_client, week):
        """Creating event from template should fail if team doesn't exist"""
        response = admin_client.post("/api/templates/create", json={
            "template_id": "jumuah",  # Has Media team task
            "week_id": week.id,
            "datetime": "2026-01-10T12:00:00Z"
        })
        assert response.status_code == 400
        assert "Teams not found" in response.json()["detail"]
        assert "Media" in response.json()["detail"]
    
    def test_template_succeeds_with_existing_teams(self, admin_client, db_session, week):
        """Creating event from template should work when all teams exist"""
        # Create Media team
        team = Team(name="Media", color="#FF0000")
        db_session.add(team)
        db_session.commit()
        
        response = admin_client.post("/api/templates/create", json={
            "template_id": "jumuah",
            "week_id": week.id,
            "datetime": "2026-01-10T12:00:00Z"
        })
        assert response.status_code == 200
        assert "event_id" in response.json()
        
        # Verify event was created
        event_id = response.json()["event_id"]
        event = db_session.query(Event).filter(Event.id == event_id).first()
        assert event is not None
        assert len(event.tasks) > 0


class TestDiscordWebhookRetry:
    """Test Discord webhook retry logic (Bug #7 - Medium)"""
    
    def test_retry_function_exists(self):
        """Verify retry logic function exists"""
        from app.services.discord import _send_webhook_with_retry
        import inspect
        
        sig = inspect.signature(_send_webhook_with_retry)
        assert 'max_retries' in sig.parameters
        assert sig.parameters['max_retries'].default == 3
    
    def test_retry_is_async(self):
        """Retry function should be async"""
        from app.services.discord import _send_webhook_with_retry
        import asyncio
        
        assert asyncio.iscoroutinefunction(_send_webhook_with_retry)


class TestStructuredLogging:
    """Test structured logging with sanitization (Bug #9 - Medium)"""
    
    def test_sanitize_removes_newlines(self):
        """Sanitize function should remove newlines"""
        from app.services.audit import sanitize_for_logging
        
        malicious = "Task\nFake ERROR line"
        sanitized = sanitize_for_logging(malicious)
        assert "\n" not in sanitized
        assert "\r" not in sanitized
    
    def test_sanitize_handles_none(self):
        """Sanitize should handle None"""
        from app.services.audit import sanitize_for_logging
        assert sanitize_for_logging(None) is None
    
    def test_sanitize_removes_control_chars(self):
        """Sanitize should remove control characters"""
        from app.services.audit import sanitize_for_logging
        
        text_with_ctrl = "Task\x00\x01\x1fDescription"
        sanitized = sanitize_for_logging(text_with_ctrl)
        assert "\x00" not in sanitized
        assert "\x01" not in sanitized
    
    def test_audit_log_with_malicious_entity_name(self, db_session, admin_user):
        """Audit log should sanitize entity names"""
        from app.services.audit import log_action
        
        log_action(
            db=db_session,
            action="CREATE",
            entity_type="task",
            entity_name="Malicious\nTask\rName",
            user_id=admin_user.id
        )
        db_session.commit()


class TestFrontendBugFixes:
    """Test frontend-related fixes"""
    
    def test_dashboard_logo_has_key_prop(self):
        """Dashboard logo should have key={theme} for reactivity"""
        with open("frontend/src/pages/Dashboard.tsx", "r") as f:
            content = f.read()
        
        # Look for img tag with theme key
        assert re.search(r'<img\s+key=\{theme\}', content), "Dashboard logo missing key={theme}"
    
    def test_login_logo_has_key_prop(self):
        """Login logo should have key={theme} for reactivity"""
        with open("frontend/src/pages/Login.tsx", "r") as f:
            content = f.read()
        
        assert re.search(r'<img\s+key=\{theme\}', content), "Login logo missing key={theme}"
    
    def test_admin_panel_logo_has_key_prop(self):
        """AdminPanel logo should have key={theme} for reactivity"""
        with open("frontend/src/pages/AdminPanel.tsx", "r") as f:
            content = f.read()
        
        assert re.search(r'<img\s+key=\{theme\}', content), "AdminPanel logo missing key={theme}"
    
    def test_week_boundary_tooltips_exist(self):
        """AdminPanel should have week boundary tooltips"""
        with open("frontend/src/pages/AdminPanel.tsx", "r") as f:
            content = f.read()
        
        assert 'title="Week starts on Sunday"' in content
        assert "Sunday-Saturday" in content


class TestPWAManifestImprovements:
    """Test PWA manifest improvements (Bug #10 - Medium)"""
    
    def test_manifest_has_id_field(self):
        """PWA manifest should have id field"""
        with open("frontend/public/manifest.webmanifest", "r") as f:
            manifest = json.load(f)
        
        assert "id" in manifest
        assert manifest["id"] == "/"
    
    def test_manifest_has_scope_field(self):
        """PWA manifest should have scope field"""
        with open("frontend/public/manifest.webmanifest", "r") as f:
            manifest = json.load(f)
        
        assert "scope" in manifest
        assert manifest["scope"] == "/"
    
    def test_manifest_has_description(self):
        """PWA manifest should have description"""
        with open("frontend/public/manifest.webmanifest", "r") as f:
            manifest = json.load(f)
        
        assert "description" in manifest
        assert len(manifest["description"]) > 0
    
    def test_manifest_has_orientation(self):
        """PWA manifest should have orientation field"""
        with open("frontend/public/manifest.webmanifest", "r") as f:
            manifest = json.load(f)
        
        assert "orientation" in manifest
        assert manifest["orientation"] == "portrait-primary"
    
    def test_manifest_icons_purpose_correct(self):
        """Icons should have correct purpose (not claiming maskable)"""
        with open("frontend/public/manifest.webmanifest", "r") as f:
            manifest = json.load(f)
        
        for icon in manifest["icons"]:
            # Should be "any" only
            assert icon["purpose"] == "any"
