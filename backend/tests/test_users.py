"""
Tests for user management endpoints.
"""
import pytest


class TestListUsers:
    """Test GET /api/users endpoint."""
    
    def test_list_users_as_admin(self, admin_client, admin_user, member_user):
        """Admin can list all users."""
        response = admin_client.get("/api/users")
        assert response.status_code == 200
        users = response.json()
        assert len(users) >= 2
        usernames = [u["username"] for u in users]
        assert "admin" in usernames
        assert "member" in usernames
    
    def test_list_users_as_member(self, member_client):
        """Non-admin cannot list users."""
        response = member_client.get("/api/users")
        assert response.status_code == 403
    
    def test_list_users_unauthenticated(self, client):
        """Unauthenticated cannot list users."""
        response = client.get("/api/users")
        assert response.status_code == 401


class TestCreateUser:
    """Test POST /api/users endpoint."""
    
    def test_create_user_as_admin(self, admin_client):
        """Admin can create a new user."""
        response = admin_client.post("/api/users", json={
            "username": "newuser",
            "password": "password123",
            "display_name": "New User",
            "role": "MEMBER"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert data["display_name"] == "New User"
        assert data["role"] == "MEMBER"
    
    def test_create_user_with_team(self, admin_client, team):
        """Admin can create user with team assignment."""
        response = admin_client.post("/api/users", json={
            "username": "teamuser",
            "password": "password123",
            "display_name": "Team User",
            "role": "MEMBER",
            "team_id": team.id
        })
        assert response.status_code == 200
        data = response.json()
        assert data["team_id"] == team.id
        assert data["team_name"] == team.name
    
    def test_create_user_with_discord_id(self, admin_client):
        """Can create user with Discord ID."""
        response = admin_client.post("/api/users", json={
            "username": "discorduser",
            "password": "password123",
            "display_name": "Discord User",
            "role": "MEMBER",
            "discord_id": "123456789012345678"
        })
        assert response.status_code == 200
        assert response.json()["discord_id"] == "123456789012345678"
    
    def test_create_duplicate_username(self, admin_client, member_user):
        """Cannot create user with existing username."""
        response = admin_client.post("/api/users", json={
            "username": "member",  # Already exists
            "password": "password123",
            "display_name": "Duplicate",
            "role": "MEMBER"
        })
        assert response.status_code == 400
        assert "exists" in response.json()["detail"].lower()
    
    def test_create_admin_user(self, admin_client):
        """Can create another admin user."""
        response = admin_client.post("/api/users", json={
            "username": "admin2",
            "password": "admin456",
            "display_name": "Admin Two",
            "role": "ADMIN"
        })
        assert response.status_code == 200
        assert response.json()["role"] == "ADMIN"
    
    def test_create_user_as_member(self, member_client):
        """Non-admin cannot create users."""
        response = member_client.post("/api/users", json={
            "username": "forbidden",
            "password": "password",
            "display_name": "Forbidden",
            "role": "MEMBER"
        })
        assert response.status_code == 403


class TestUpdateUser:
    """Test PUT /api/users/{id} endpoint."""
    
    def test_update_user_display_name(self, admin_client, member_user):
        """Admin can update user display name."""
        response = admin_client.put(f"/api/users/{member_user.id}", json={
            "display_name": "Updated Name"
        })
        assert response.status_code == 200
        assert response.json()["display_name"] == "Updated Name"
    
    def test_update_user_team(self, admin_client, member_user, team):
        """Admin can assign user to team."""
        response = admin_client.put(f"/api/users/{member_user.id}", json={
            "team_id": team.id
        })
        assert response.status_code == 200
        assert response.json()["team_id"] == team.id
    
    def test_update_user_password(self, admin_client, member_user, client):
        """Admin can reset user password."""
        response = admin_client.put(f"/api/users/{member_user.id}", json={
            "password": "newpassword"
        })
        assert response.status_code == 200
        
        # Verify new password works
        login_response = client.post("/api/auth/login", json={
            "username": "member",
            "password": "newpassword"
        })
        assert login_response.status_code == 200
    
    def test_update_nonexistent_user(self, admin_client):
        """Updating non-existent user returns 404."""
        response = admin_client.put("/api/users/9999", json={
            "display_name": "Ghost"
        })
        assert response.status_code == 404
    
    def test_update_user_as_member(self, member_client, admin_user):
        """Non-admin cannot update users."""
        response = member_client.put(f"/api/users/{admin_user.id}", json={
            "display_name": "Hacked"
        })
        assert response.status_code == 403


class TestDeleteUser:
    """Test DELETE /api/users/{id} endpoint."""
    
    def test_delete_user(self, admin_client, member_user):
        """Admin can delete a user."""
        response = admin_client.delete(f"/api/users/{member_user.id}")
        assert response.status_code == 200
        
        # Verify user is gone
        list_response = admin_client.get("/api/users")
        usernames = [u["username"] for u in list_response.json()]
        assert "member" not in usernames
    
    def test_delete_nonexistent_user(self, admin_client):
        """Deleting non-existent user returns 404."""
        response = admin_client.delete("/api/users/9999")
        assert response.status_code == 404
    
    def test_delete_user_as_member(self, member_client, admin_user):
        """Non-admin cannot delete users."""
        response = member_client.delete(f"/api/users/{admin_user.id}")
        assert response.status_code == 403


class TestBatchCreateUsers:
    """Test POST /api/users/batch endpoint."""
    
    def test_batch_create_users(self, admin_client):
        """Batch create multiple users."""
        response = admin_client.post("/api/users/batch", json={
            "users": [
                {"username": "batch1", "display_name": "Batch One"},
                {"username": "batch2", "display_name": "Batch Two"},
                {"username": "batch3", "display_name": "Batch Three"}
            ]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 3
        assert result["skipped"] == 0
    
    def test_batch_create_with_team_name(self, admin_client, team):
        """Batch create with team name lookup."""
        response = admin_client.post("/api/users/batch", json={
            "users": [
                {
                    "username": "mediamember",
                    "display_name": "Media Member",
                    "team_name": "Media"
                }
            ]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 1
    
    def test_batch_create_skips_existing(self, admin_client, member_user):
        """Batch create skips existing usernames."""
        response = admin_client.post("/api/users/batch", json={
            "users": [
                {"username": "member", "display_name": "Duplicate"},  # Exists
                {"username": "newbatch", "display_name": "New Batch"}
            ]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 1
        assert result["skipped"] == 1
    
    def test_batch_create_default_password(self, admin_client, client):
        """Password defaults to username if not provided."""
        admin_client.post("/api/users/batch", json={
            "users": [{"username": "defaultpw", "display_name": "Default PW"}]
        })
        
        # Login with username as password
        response = client.post("/api/auth/login", json={
            "username": "defaultpw",
            "password": "defaultpw"
        })
        assert response.status_code == 200
    
    def test_batch_create_invalid_team(self, admin_client):
        """Batch create with invalid team name reports error."""
        response = admin_client.post("/api/users/batch", json={
            "users": [
                {"username": "invalidteam", "display_name": "Invalid Team", "team_name": "Nonexistent"}
            ]
        })
        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 0
        assert len(result["errors"]) > 0
        assert "not found" in result["errors"][0].lower()
