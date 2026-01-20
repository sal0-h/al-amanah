from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date, timedelta

from app.database import get_db
from app.models import (
    User, Task, Event, Week, Semester, Team, 
    TaskStatus, TaskType, Role, RosterMember
)
from app.middleware.auth import get_admin_user

router = APIRouter(prefix="/api/stats", tags=["statistics"])


def get_active_semester_id(db: Session) -> Optional[int]:
    """Get the active semester ID."""
    active = db.query(Semester).filter(Semester.is_active == True).first()
    return active.id if active else None


class OverviewStats(BaseModel):
    total_users: int
    total_semesters: int
    total_events: int
    total_tasks: int
    tasks_completed: int
    tasks_pending: int
    tasks_cannot_do: int
    completion_rate: float


class UserStats(BaseModel):
    user_id: int
    display_name: str
    team_name: str | None
    tasks_assigned: int
    tasks_completed: int
    tasks_cannot_do: int
    completion_rate: float


class TeamStats(BaseModel):
    team_id: int
    team_name: str
    member_count: int
    tasks_assigned: int
    tasks_completed: int
    completion_rate: float


class SemesterStats(BaseModel):
    semester_id: int
    semester_name: str
    weeks_count: int
    events_count: int
    tasks_count: int
    tasks_completed: int
    completion_rate: float


class EventTypeStats(BaseModel):
    event_name: str
    count: int


class WeeklyActivity(BaseModel):
    week_number: int
    start_date: str
    tasks_created: int
    tasks_completed: int


class ActiveSemesterInfo(BaseModel):
    id: int | None
    name: str | None


@router.get("/active-semester", response_model=ActiveSemesterInfo)
async def get_active_semester(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get the active semester info."""
    active = db.query(Semester).filter(Semester.is_active == True).first()
    return ActiveSemesterInfo(
        id=active.id if active else None,
        name=active.name if active else None
    )


@router.get("/overview", response_model=OverviewStats)
async def get_overview_stats(
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get overall statistics."""
    total_users = db.query(User).count()
    total_semesters = db.query(Semester).count()
    
    # Filter by semester if provided
    if semester_id:
        week_ids = [w.id for w in db.query(Week).filter(Week.semester_id == semester_id).all()]
        event_ids = [e.id for e in db.query(Event).filter(Event.week_id.in_(week_ids)).all()] if week_ids else []
        
        total_events = len(event_ids)
        tasks_query = db.query(Task).filter(Task.event_id.in_(event_ids)) if event_ids else db.query(Task).filter(False)
    else:
        total_events = db.query(Event).count()
        tasks_query = db.query(Task)
    
    total_tasks = tasks_query.count()
    tasks_completed = tasks_query.filter(Task.status == TaskStatus.DONE).count()
    tasks_pending = tasks_query.filter(Task.status == TaskStatus.PENDING).count()
    tasks_cannot_do = tasks_query.filter(Task.status == TaskStatus.CANNOT_DO).count()
    
    completion_rate = (tasks_completed / total_tasks * 100) if total_tasks > 0 else 0.0
    
    return OverviewStats(
        total_users=total_users,
        total_semesters=total_semesters,
        total_events=total_events,
        total_tasks=total_tasks,
        tasks_completed=tasks_completed,
        tasks_pending=tasks_pending,
        tasks_cannot_do=tasks_cannot_do,
        completion_rate=round(completion_rate, 1)
    )


@router.get("/users", response_model=List[UserStats])
async def get_user_stats(
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get statistics per user."""
    users = db.query(User).filter(User.role != Role.ADMIN).all()
    
    # Get event IDs for semester filter
    event_ids = None
    if semester_id:
        week_ids = [w.id for w in db.query(Week).filter(Week.semester_id == semester_id).all()]
        event_ids = [e.id for e in db.query(Event).filter(Event.week_id.in_(week_ids)).all()] if week_ids else []
    
    stats = []
    for user in users:
        # Get tasks assigned to this user
        tasks_query = db.query(Task).filter(Task.assigned_to == user.id)
        if event_ids is not None:
            tasks_query = tasks_query.filter(Task.event_id.in_(event_ids)) if event_ids else tasks_query.filter(False)
        
        tasks_assigned = tasks_query.count()
        tasks_completed = tasks_query.filter(Task.status == TaskStatus.DONE).count()
        tasks_cannot_do = tasks_query.filter(Task.status == TaskStatus.CANNOT_DO).count()
        
        completion_rate = (tasks_completed / tasks_assigned * 100) if tasks_assigned > 0 else 0.0
        
        stats.append(UserStats(
            user_id=user.id,
            display_name=user.display_name,
            team_name=user.team.name if user.team else None,
            tasks_assigned=tasks_assigned,
            tasks_completed=tasks_completed,
            tasks_cannot_do=tasks_cannot_do,
            completion_rate=round(completion_rate, 1)
        ))
    
    # Sort by completion rate descending
    stats.sort(key=lambda x: (-x.completion_rate, -x.tasks_completed))
    return stats


@router.get("/teams", response_model=List[TeamStats])
async def get_team_stats(
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get statistics per team."""
    teams = db.query(Team).all()
    
    # Get event IDs for semester filter
    event_ids = None
    if semester_id:
        week_ids = [w.id for w in db.query(Week).filter(Week.semester_id == semester_id).all()]
        event_ids = [e.id for e in db.query(Event).filter(Event.week_id.in_(week_ids)).all()] if week_ids else []
    
    stats = []
    for team in teams:
        member_count = db.query(User).filter(User.team_id == team.id).count()
        
        # Get tasks assigned to this team
        tasks_query = db.query(Task).filter(Task.assigned_team_id == team.id)
        if event_ids is not None:
            tasks_query = tasks_query.filter(Task.event_id.in_(event_ids)) if event_ids else tasks_query.filter(False)
        
        tasks_assigned = tasks_query.count()
        tasks_completed = tasks_query.filter(Task.status == TaskStatus.DONE).count()
        
        completion_rate = (tasks_completed / tasks_assigned * 100) if tasks_assigned > 0 else 0.0
        
        stats.append(TeamStats(
            team_id=team.id,
            team_name=team.name,
            member_count=member_count,
            tasks_assigned=tasks_assigned,
            tasks_completed=tasks_completed,
            completion_rate=round(completion_rate, 1)
        ))
    
    stats.sort(key=lambda x: (-x.completion_rate, -x.tasks_completed))
    return stats


@router.get("/semesters", response_model=List[SemesterStats])
async def get_semester_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get statistics per semester."""
    semesters = db.query(Semester).order_by(Semester.start_date.desc()).all()
    
    stats = []
    for semester in semesters:
        weeks = db.query(Week).filter(Week.semester_id == semester.id).all()
        week_ids = [w.id for w in weeks]
        
        events = db.query(Event).filter(Event.week_id.in_(week_ids)).all() if week_ids else []
        event_ids = [e.id for e in events]
        
        tasks_query = db.query(Task).filter(Task.event_id.in_(event_ids)) if event_ids else db.query(Task).filter(False)
        tasks_count = tasks_query.count()
        tasks_completed = tasks_query.filter(Task.status == TaskStatus.DONE).count()
        
        completion_rate = (tasks_completed / tasks_count * 100) if tasks_count > 0 else 0.0
        
        stats.append(SemesterStats(
            semester_id=semester.id,
            semester_name=semester.name,
            weeks_count=len(weeks),
            events_count=len(events),
            tasks_count=tasks_count,
            tasks_completed=tasks_completed,
            completion_rate=round(completion_rate, 1)
        ))
    
    return stats


@router.get("/activity", response_model=List[WeeklyActivity])
async def get_weekly_activity(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get weekly activity for a semester."""
    weeks = db.query(Week).filter(
        Week.semester_id == semester_id
    ).order_by(Week.week_number).all()
    
    activity = []
    for week in weeks:
        event_ids = [e.id for e in db.query(Event).filter(Event.week_id == week.id).all()]
        
        if event_ids:
            tasks_created = db.query(Task).filter(Task.event_id.in_(event_ids)).count()
            tasks_completed = db.query(Task).filter(
                Task.event_id.in_(event_ids),
                Task.status == TaskStatus.DONE
            ).count()
        else:
            tasks_created = 0
            tasks_completed = 0
        
        activity.append(WeeklyActivity(
            week_number=week.week_number,
            start_date=week.start_date.isoformat(),
            tasks_created=tasks_created,
            tasks_completed=tasks_completed
        ))
    
    return activity
