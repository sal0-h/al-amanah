from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import json

from app.database import get_db
from app.models import (
    User, Semester, Week, Event, Task, Team,
    TaskStatus, TaskType, Role, RosterMember
)
from app.middleware.auth import get_admin_user

router = APIRouter(prefix="/api/export", tags=["export"])


# ============== EXPORT SCHEMAS ==============

class ExportTask(BaseModel):
    title: str
    description: Optional[str]
    task_type: str
    status: str
    assigned_to_username: Optional[str]
    assigned_team_name: Optional[str]
    assigned_pool_usernames: List[str] = []  # Multi-user pool assignments
    completed_by_username: Optional[str]
    cannot_do_reason: Optional[str]


class ExportEvent(BaseModel):
    name: str
    datetime: str
    tasks: List[ExportTask]


class ExportWeek(BaseModel):
    week_number: int
    start_date: str
    end_date: str
    events: List[ExportEvent]


class ExportSemester(BaseModel):
    name: str
    start_date: str
    end_date: str
    is_active: bool
    weeks: List[ExportWeek]
    roster_usernames: List[str]


class ExportData(BaseModel):
    exported_at: str
    version: str = "1.0"
    semesters: List[ExportSemester]


class ImportResult(BaseModel):
    semesters_created: int
    weeks_created: int
    events_created: int
    tasks_created: int
    errors: List[str]


# ============== EXPORT ENDPOINTS ==============

@router.get("/semester/{semester_id}")
async def export_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Export a single semester with all its data."""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    export_data = build_semester_export(semester, db)
    
    return ExportData(
        exported_at=datetime.now().isoformat(),
        semesters=[export_data]
    )


@router.get("/all")
async def export_all(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Export all semesters with their data."""
    semesters = db.query(Semester).order_by(Semester.start_date.desc()).all()
    
    export_data = [build_semester_export(s, db) for s in semesters]
    
    return ExportData(
        exported_at=datetime.now().isoformat(),
        semesters=export_data
    )


def build_semester_export(semester: Semester, db: Session) -> ExportSemester:
    """Build export data for a semester."""
    weeks = db.query(Week).filter(Week.semester_id == semester.id).order_by(Week.week_number).all()
    
    export_weeks = []
    for week in weeks:
        events = db.query(Event).filter(Event.week_id == week.id).order_by(Event.datetime).all()
        
        export_events = []
        for event in events:
            tasks = db.query(Task).filter(Task.event_id == event.id).all()
            
            export_tasks = []
            for task in tasks:
                assigned_username = None
                if task.assigned_to:
                    user = db.query(User).filter(User.id == task.assigned_to).first()
                    assigned_username = user.username if user else None
                
                team_name = None
                if task.assigned_team_id:
                    team = db.query(Team).filter(Team.id == task.assigned_team_id).first()
                    team_name = team.name if team else None
                
                # Get multi-user pool assignments
                pool_usernames = []
                for assignment in task.assignments:
                    if assignment.user:
                        pool_usernames.append(assignment.user.username)
                
                completed_by_username = None
                if task.completed_by:
                    user = db.query(User).filter(User.id == task.completed_by).first()
                    completed_by_username = user.username if user else None
                
                export_tasks.append(ExportTask(
                    title=task.title,
                    description=task.description,
                    task_type=task.task_type.value,
                    status=task.status.value,
                    assigned_to_username=assigned_username,
                    assigned_team_name=team_name,
                    assigned_pool_usernames=pool_usernames,
                    completed_by_username=completed_by_username,
                    cannot_do_reason=task.cannot_do_reason
                ))
            
            export_events.append(ExportEvent(
                name=event.name,
                datetime=event.datetime.isoformat(),
                tasks=export_tasks
            ))
        
        export_weeks.append(ExportWeek(
            week_number=week.week_number,
            start_date=week.start_date.isoformat(),
            end_date=week.end_date.isoformat(),
            events=export_events
        ))
    
    # Get roster usernames
    roster_members = db.query(RosterMember, User).join(
        User, RosterMember.user_id == User.id
    ).filter(RosterMember.semester_id == semester.id).all()
    roster_usernames = [u.username for rm, u in roster_members]
    
    return ExportSemester(
        name=semester.name,
        start_date=semester.start_date.isoformat(),
        end_date=semester.end_date.isoformat(),
        is_active=semester.is_active,
        weeks=export_weeks,
        roster_usernames=roster_usernames
    )


# ============== IMPORT ENDPOINTS ==============

@router.post("/import", response_model=ImportResult)
async def import_data(
    data: ExportData,
    skip_existing: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Import semester data from JSON."""
    semesters_created = 0
    weeks_created = 0
    events_created = 0
    tasks_created = 0
    errors = []
    
    for sem_data in data.semesters:
        try:
            # Check if semester exists
            existing = db.query(Semester).filter(Semester.name == sem_data.name).first()
            if existing:
                if skip_existing:
                    errors.append(f"Semester '{sem_data.name}' already exists, skipped")
                    continue
                else:
                    errors.append(f"Semester '{sem_data.name}' already exists")
                    continue
            
            # Create semester
            semester = Semester(
                name=sem_data.name,
                start_date=datetime.fromisoformat(sem_data.start_date).date(),
                end_date=datetime.fromisoformat(sem_data.end_date).date(),
                is_active=False  # Don't auto-activate imported semesters
            )
            db.add(semester)
            db.flush()
            semesters_created += 1
            
            # Add roster members
            for username in sem_data.roster_usernames:
                user = db.query(User).filter(User.username == username).first()
                if user:
                    rm = RosterMember(semester_id=semester.id, user_id=user.id)
                    db.add(rm)
            
            # Create weeks
            for week_data in sem_data.weeks:
                week = Week(
                    semester_id=semester.id,
                    week_number=week_data.week_number,
                    start_date=datetime.fromisoformat(week_data.start_date).date(),
                    end_date=datetime.fromisoformat(week_data.end_date).date()
                )
                db.add(week)
                # Store week for later ID resolution (no flush yet)
                weeks_created += 1
                
                # Create events
                for event_data in week_data.events:
                    event = Event(
                        week_id=None,  # Will be set after flush
                        name=event_data.name,
                        datetime=datetime.fromisoformat(event_data.datetime.replace('Z', '+00:00'))
                    )
                    event.week = week  # Use relationship instead of ID
                    db.add(event)
                    events_created += 1
                    
                    # Create tasks
                    for task_data in event_data.tasks:
                        # Resolve user/team assignments
                        assigned_to = None
                        if task_data.assigned_to_username:
                            user = db.query(User).filter(User.username == task_data.assigned_to_username).first()
                            assigned_to = user.id if user else None
                        
                        assigned_team_id = None
                        if task_data.assigned_team_name:
                            team = db.query(Team).filter(Team.name == task_data.assigned_team_name).first()
                            assigned_team_id = team.id if team else None
                        
                        completed_by = None
                        if task_data.completed_by_username:
                            completer = db.query(User).filter(User.username == task_data.completed_by_username).first()
                            completed_by = completer.id if completer else None
                        
                        task = Task(
                            event_id=None,  # Will be set via relationship
                            title=task_data.title,
                            description=task_data.description,
                            task_type=TaskType[task_data.task_type],
                            status=TaskStatus[task_data.status],
                            assigned_to=assigned_to,
                            assigned_team_id=assigned_team_id,
                            completed_by=completed_by,
                            cannot_do_reason=task_data.cannot_do_reason
                        )
                        task.event = event  # Use relationship
                        db.add(task)
                        
                        # Restore multi-user pool assignments
                        from app.models import TaskAssignment
                        for pool_username in getattr(task_data, 'assigned_pool_usernames', []):
                            pool_user = db.query(User).filter(User.username == pool_username).first()
                            if pool_user:
                                assignment = TaskAssignment(task_id=None, user_id=pool_user.id)
                                assignment.task = task  # Use relationship
                                db.add(assignment)
                        
                        tasks_created += 1
            
            # Single commit at end of semester - all or nothing
            db.commit()
            
        except Exception as e:
            db.rollback()
            errors.append(f"Error importing semester '{sem_data.name}': {str(e)}")
    
    return ImportResult(
        semesters_created=semesters_created,
        weeks_created=weeks_created,
        events_created=events_created,
        tasks_created=tasks_created,
        errors=errors
    )
