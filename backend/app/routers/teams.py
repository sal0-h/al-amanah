from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Team, User
from app.middleware.auth import get_admin_user, get_current_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


class TeamCreate(BaseModel):
    name: str
    color: Optional[str] = None  # Hex color


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TeamOut(BaseModel):
    id: int
    name: str
    color: Optional[str]
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[TeamOut])
async def list_teams(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get all teams."""
    return db.query(Team).order_by(Team.name).all()


@router.post("", response_model=TeamOut)
async def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create a new team (admin only)."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name cannot be empty")
    
    # Check if team name exists (case-insensitive)
    existing = db.query(Team).filter(Team.name.ilike(name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    
    team = Team(name=name, color=data.color)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.put("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Update a team (admin only)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if data.name:
        # Check for duplicate name
        existing = db.query(Team).filter(Team.name == data.name, Team.id != team_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Team name already exists")
        team.name = data.name
    
    if data.color is not None:
        team.color = data.color
    
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Delete a team (admin only). Will unassign users from this team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Unassign users from this team
    db.query(User).filter(User.team_id == team_id).update({"team_id": None})
    
    db.delete(team)
    db.commit()
    return {"message": "Team deleted"}
