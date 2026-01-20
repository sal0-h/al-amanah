from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Semester, RosterMember, Role, Team
from app.middleware.auth import get_admin_user

router = APIRouter(prefix="/api/semesters", tags=["roster"])


class RosterMemberOut(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    role: str
    team_id: int | None
    team_name: str | None
    discord_id: str | None
    
    class Config:
        from_attributes = True


class AddToRosterRequest(BaseModel):
    user_ids: List[int]


class RosterActionResult(BaseModel):
    added: int
    skipped: int


@router.get("/{semester_id}/roster", response_model=List[RosterMemberOut])
async def get_roster(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get all users in a semester's roster."""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Get roster members with user info
    roster = db.query(RosterMember, User).join(
        User, RosterMember.user_id == User.id
    ).filter(RosterMember.semester_id == semester_id).all()
    
    return [
        RosterMemberOut(
            id=rm.id,
            user_id=u.id,
            username=u.username,
            display_name=u.display_name,
            role=u.role.value,
            team_id=u.team_id,
            team_name=u.team.name if u.team else None,
            discord_id=u.discord_id
        )
        for rm, u in roster
    ]


@router.post("/{semester_id}/roster", response_model=RosterActionResult)
async def add_to_roster(
    semester_id: int,
    data: AddToRosterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Add users to a semester's roster."""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    added = 0
    skipped = 0
    
    for user_id in data.user_ids:
        # Check user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            skipped += 1
            continue
        
        # Check not already in roster
        existing = db.query(RosterMember).filter(
            RosterMember.semester_id == semester_id,
            RosterMember.user_id == user_id
        ).first()
        
        if existing:
            skipped += 1
            continue
        
        # Add to roster
        rm = RosterMember(semester_id=semester_id, user_id=user_id)
        db.add(rm)
        added += 1
    
    db.commit()
    return RosterActionResult(added=added, skipped=skipped)


@router.post("/{semester_id}/roster/add-all", response_model=RosterActionResult)
async def add_all_to_roster(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Add all existing users to a semester's roster."""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Get all non-admin users
    users = db.query(User).filter(User.role != Role.ADMIN).all()
    
    added = 0
    skipped = 0
    
    for user in users:
        existing = db.query(RosterMember).filter(
            RosterMember.semester_id == semester_id,
            RosterMember.user_id == user.id
        ).first()
        
        if existing:
            skipped += 1
            continue
        
        rm = RosterMember(semester_id=semester_id, user_id=user.id)
        db.add(rm)
        added += 1
    
    db.commit()
    return RosterActionResult(added=added, skipped=skipped)


@router.delete("/{semester_id}/roster/{user_id}")
async def remove_from_roster(
    semester_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Remove a user from a semester's roster."""
    rm = db.query(RosterMember).filter(
        RosterMember.semester_id == semester_id,
        RosterMember.user_id == user_id
    ).first()
    
    if not rm:
        raise HTTPException(status_code=404, detail="User not in roster")
    
    db.delete(rm)
    db.commit()
    return {"message": "Removed from roster"}


@router.get("/{semester_id}/available-users", response_model=List[RosterMemberOut])
async def get_available_users(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get users NOT in the semester's roster (excluding admins)."""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Get user IDs already in roster
    roster_user_ids = [rm.user_id for rm in db.query(RosterMember).filter(
        RosterMember.semester_id == semester_id
    ).all()]
    
    # Get users not in roster and not admin
    available = db.query(User).filter(
        User.id.notin_(roster_user_ids) if roster_user_ids else True,
        User.role != Role.ADMIN
    ).all()
    
    return [
        RosterMemberOut(
            id=0,  # Not a roster member yet
            user_id=u.id,
            username=u.username,
            display_name=u.display_name,
            role=u.role.value,
            team_id=u.team_id,
            team_name=u.team.name if u.team else None,
            discord_id=u.discord_id
        )
        for u in available
    ]
