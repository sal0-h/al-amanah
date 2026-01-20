"""
Tests for roster management endpoints.
"""
import pytest
from app.models import RosterMember


class TestGetRoster:
    """Test GET /api/semesters/{id}/roster endpoint."""
    
    def test_get_roster(self, admin_client, semester, roster_member, member_user):
        """Admin can get semester roster."""
        response = admin_client.get(f"/api/semesters/{semester.id}/roster")
        assert response.status_code == 200
        roster = response.json()
        assert len(roster) >= 1
        assert roster[0]["username"] == "member"
    
    def test_get_roster_includes_team(self, admin_client, db_session, semester, team):
        """Roster includes team information."""
        from app.models import User, Role
        from app.middleware.auth import hash_password
        
        user_with_team = User(
            username="teamroster",
            password_hash=hash_password("pass"),
            display_name="Team Roster User",
            role=Role.MEMBER,
            team_id=team.id
        )
        db_session.add(user_with_team)
        db_session.flush()
        
        rm = RosterMember(semester_id=semester.id, user_id=user_with_team.id)
        db_session.add(rm)
        db_session.commit()
        
        response = admin_client.get(f"/api/semesters/{semester.id}/roster")
        roster = response.json()
        team_user = next((r for r in roster if r["username"] == "teamroster"), None)
        assert team_user is not None
        assert team_user["team_id"] == team.id
        assert team_user["team_name"] == team.name
    
    def test_get_roster_as_member(self, member_client, semester):
        """Non-admin cannot access roster."""
        response = member_client.get(f"/api/semesters/{semester.id}/roster")
        assert response.status_code == 403


class TestAddToRoster:
    """Test POST /api/semesters/{id}/roster endpoint."""
    
    def test_add_to_roster(self, admin_client, db_session, semester):
        """Admin can add users to roster."""
        from app.models import User, Role
        from app.middleware.auth import hash_password
        
        new_user = User(
            username="newroster",
            password_hash=hash_password("pass"),
            display_name="New Roster",
            role=Role.MEMBER
        )
        db_session.add(new_user)
        db_session.commit()
        
        response = admin_client.post(f"/api/semesters/{semester.id}/roster", json={
            "user_ids": [new_user.id]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["added"] == 1
        assert result["skipped"] == 0
    
    def test_add_multiple_to_roster(self, admin_client, db_session, semester):
        """Can add multiple users at once."""
        from app.models import User, Role
        from app.middleware.auth import hash_password
        
        users = []
        for i in range(3):
            u = User(
                username=f"bulkroster{i}",
                password_hash=hash_password("pass"),
                display_name=f"Bulk Roster {i}",
                role=Role.MEMBER
            )
            db_session.add(u)
            users.append(u)
        db_session.commit()
        
        response = admin_client.post(f"/api/semesters/{semester.id}/roster", json={
            "user_ids": [u.id for u in users]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["added"] == 3
    
    def test_add_to_roster_skips_existing(self, admin_client, semester, roster_member, member_user):
        """Adding existing roster member skips."""
        response = admin_client.post(f"/api/semesters/{semester.id}/roster", json={
            "user_ids": [member_user.id]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["added"] == 0
        assert result["skipped"] == 1
    
    def test_add_nonexistent_user(self, admin_client, semester):
        """Adding non-existent user skips."""
        response = admin_client.post(f"/api/semesters/{semester.id}/roster", json={
            "user_ids": [9999]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["skipped"] == 1
    
    def test_add_to_roster_as_member(self, member_client, semester, admin_user):
        """Non-admin cannot add to roster."""
        response = member_client.post(f"/api/semesters/{semester.id}/roster", json={
            "user_ids": [admin_user.id]
        })
        assert response.status_code == 403


class TestAddAllToRoster:
    """Test POST /api/semesters/{id}/roster/add-all endpoint."""
    
    def test_add_all_to_roster(self, admin_client, db_session, semester, member_user):
        """Admin can add all non-admin users."""
        from app.models import User, Role
        from app.middleware.auth import hash_password
        
        # Create more members
        for i in range(2):
            u = User(
                username=f"autorosters{i}",
                password_hash=hash_password("pass"),
                display_name=f"Auto Roster {i}",
                role=Role.MEMBER
            )
            db_session.add(u)
        db_session.commit()
        
        response = admin_client.post(f"/api/semesters/{semester.id}/roster/add-all")
        assert response.status_code == 200
        result = response.json()
        assert result["added"] >= 2  # At least the 2 new users
    
    def test_add_all_excludes_admins(self, admin_client, semester, admin_user, member_user):
        """Add all excludes admin users."""
        response = admin_client.post(f"/api/semesters/{semester.id}/roster/add-all")
        assert response.status_code == 200
        
        # Check roster doesn't include admin
        roster_response = admin_client.get(f"/api/semesters/{semester.id}/roster")
        roster = roster_response.json()
        usernames = [r["username"] for r in roster]
        assert "admin" not in usernames


class TestRemoveFromRoster:
    """Test DELETE /api/semesters/{id}/roster/{user_id} endpoint."""
    
    def test_remove_from_roster(self, admin_client, semester, roster_member, member_user):
        """Admin can remove user from roster."""
        response = admin_client.delete(f"/api/semesters/{semester.id}/roster/{member_user.id}")
        assert response.status_code == 200
        
        # Verify removed
        roster_response = admin_client.get(f"/api/semesters/{semester.id}/roster")
        roster = roster_response.json()
        usernames = [r["username"] for r in roster]
        assert "member" not in usernames
    
    def test_remove_nonexistent_roster_member(self, admin_client, semester):
        """Removing non-roster member returns 404."""
        response = admin_client.delete(f"/api/semesters/{semester.id}/roster/9999")
        assert response.status_code == 404
    
    def test_remove_from_roster_as_member(self, member_client, semester, member_user):
        """Non-admin cannot remove from roster."""
        response = member_client.delete(f"/api/semesters/{semester.id}/roster/{member_user.id}")
        assert response.status_code == 403


class TestAvailableUsers:
    """Test GET /api/semesters/{id}/available-users endpoint."""
    
    def test_get_available_users(self, admin_client, semester, roster_member, member_user, admin_user):
        """Get users not in roster."""
        response = admin_client.get(f"/api/semesters/{semester.id}/available-users")
        assert response.status_code == 200
        available = response.json()
        # member_user is in roster, so shouldn't be available
        usernames = [u["username"] for u in available]
        assert "member" not in usernames
        # admin should also not be in available (excluded)
        assert "admin" not in usernames
    
    def test_available_excludes_admins(self, admin_client, db_session, semester):
        """Available users excludes admins."""
        from app.models import User, Role
        from app.middleware.auth import hash_password
        
        admin2 = User(
            username="admin2",
            password_hash=hash_password("pass"),
            display_name="Admin 2",
            role=Role.ADMIN
        )
        db_session.add(admin2)
        db_session.commit()
        
        response = admin_client.get(f"/api/semesters/{semester.id}/available-users")
        available = response.json()
        usernames = [u["username"] for u in available]
        assert "admin2" not in usernames
