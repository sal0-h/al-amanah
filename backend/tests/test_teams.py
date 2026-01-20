"""
Tests for team endpoints.
"""
import pytest


class TestListTeams:
    """Test GET /api/teams endpoint."""
    
    def test_list_teams(self, admin_client, team):
        """List all teams."""
        response = admin_client.get("/api/teams")
        assert response.status_code == 200
        teams = response.json()
        assert len(teams) >= 1
        assert teams[0]["name"] == "Media"
    
    def test_list_teams_as_member(self, member_client, team):
        """Members can list teams."""
        response = member_client.get("/api/teams")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestCreateTeam:
    """Test POST /api/teams endpoint."""
    
    def test_create_team(self, admin_client):
        """Admin can create a team."""
        response = admin_client.post("/api/teams", json={
            "name": "Events",
            "color": "#00FF00"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Events"
        assert data["color"] == "#00FF00"
    
    def test_create_team_without_color(self, admin_client):
        """Can create team without color."""
        response = admin_client.post("/api/teams", json={
            "name": "Outreach"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Outreach"
    
    def test_create_team_as_member(self, member_client):
        """Non-admin cannot create teams."""
        response = member_client.post("/api/teams", json={
            "name": "Forbidden Team"
        })
        assert response.status_code == 403


class TestUpdateTeam:
    """Test PUT /api/teams/{id} endpoint."""
    
    def test_update_team_name(self, admin_client, team):
        """Admin can update team name."""
        response = admin_client.put(f"/api/teams/{team.id}", json={
            "name": "Updated Media"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Media"
    
    def test_update_team_color(self, admin_client, team):
        """Admin can update team color."""
        response = admin_client.put(f"/api/teams/{team.id}", json={
            "color": "#0000FF"
        })
        assert response.status_code == 200
        assert response.json()["color"] == "#0000FF"
    
    def test_update_team_as_member(self, member_client, team):
        """Non-admin cannot update teams."""
        response = member_client.put(f"/api/teams/{team.id}", json={
            "name": "Hacked"
        })
        assert response.status_code == 403


class TestDeleteTeam:
    """Test DELETE /api/teams/{id} endpoint."""
    
    def test_delete_team(self, admin_client, team):
        """Admin can delete a team."""
        response = admin_client.delete(f"/api/teams/{team.id}")
        assert response.status_code == 200
    
    def test_delete_nonexistent_team(self, admin_client):
        """Deleting non-existent team returns 404."""
        response = admin_client.delete("/api/teams/9999")
        assert response.status_code == 404
    
    def test_delete_team_as_member(self, member_client, team):
        """Non-admin cannot delete teams."""
        response = member_client.delete(f"/api/teams/{team.id}")
        assert response.status_code == 403
