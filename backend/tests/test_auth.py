"""
Tests for authentication endpoints.
"""
import pytest


class TestLogin:
    """Test /api/auth/login endpoint."""
    
    def test_login_success(self, client, admin_user):
        """Successful login returns user data and sets session cookie."""
        response = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful"
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "ADMIN"
        assert "session" in response.cookies
    
    def test_login_wrong_password(self, client, admin_user):
        """Wrong password returns 401."""
        response = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]
    
    def test_login_nonexistent_user(self, client):
        """Non-existent user returns 401."""
        response = client.post("/api/auth/login", json={
            "username": "nobody",
            "password": "password"
        })
        assert response.status_code == 401
    
    def test_login_empty_fields(self, client):
        """Empty fields are rejected (invalid credentials)."""
        response = client.post("/api/auth/login", json={
            "username": "",
            "password": ""
        })
        # Empty strings are valid JSON but result in auth failure (401)
        assert response.status_code == 401


class TestLogout:
    """Test /api/auth/logout endpoint."""
    
    def test_logout_success(self, admin_client):
        """Logout clears session cookie."""
        response = admin_client.post("/api/auth/logout")
        assert response.status_code == 200
        assert response.json()["message"] == "Logged out"
    
    def test_logout_unauthenticated(self, client):
        """Logout without session still succeeds (idempotent)."""
        response = client.post("/api/auth/logout")
        # Should still return success even if not logged in
        assert response.status_code == 200


class TestGetMe:
    """Test /api/auth/me endpoint."""
    
    def test_get_me_authenticated(self, admin_client, admin_user):
        """Authenticated user gets their data."""
        response = admin_client.get("/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["id"] == admin_user.id
    
    def test_get_me_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
    
    def test_get_me_includes_team(self, team_member_client, team_member, team):
        """Response includes team information."""
        response = team_member_client.get("/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["team_id"] == team.id
        assert data["team_name"] == team.name


class TestChangePassword:
    """Test /api/auth/change-password endpoint."""
    
    def test_change_password_success(self, admin_client):
        """Password change with correct current password."""
        response = admin_client.post("/api/auth/change-password", json={
            "current_password": "admin123",
            "new_password": "newpassword123"
        })
        assert response.status_code == 200
        assert "changed" in response.json()["message"].lower()
    
    def test_change_password_wrong_current(self, admin_client):
        """Wrong current password returns 400."""
        response = admin_client.post("/api/auth/change-password", json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400
    
    def test_change_password_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        response = client.post("/api/auth/change-password", json={
            "current_password": "old",
            "new_password": "new"
        })
        assert response.status_code == 401


class TestSessionExpiry:
    """Test session token behavior."""
    
    def test_invalid_session_token(self, client):
        """Invalid session token returns 401."""
        client.cookies.set("session", "invalid-token-here")
        response = client.get("/api/auth/me")
        assert response.status_code == 401
    
    def test_tampered_session_token(self, client, admin_user):
        """Tampered session token returns 401."""
        from app.middleware.auth import create_session_token
        token = create_session_token(admin_user.id)
        # Tamper with the token
        tampered = token[:-5] + "xxxxx"
        client.cookies.set("session", tampered)
        response = client.get("/api/auth/me")
        assert response.status_code == 401
