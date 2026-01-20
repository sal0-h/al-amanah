from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional

from app.database import get_db
from app.models import Semester, Week, Event, Task, User, Role, Team
from app.middleware.auth import get_current_user
from pydantic import BaseModel


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class TaskData(BaseModel):
    id: int
    title: str
    description: Optional[str]
    task_type: str
    status: str
    assigned_to: Optional[int]
    assigned_team: Optional[str]
    assignee_name: Optional[str]
    reminder_time: Optional[str]
    reminder_sent: bool
    cannot_do_reason: Optional[str]
    
    class Config:
        from_attributes = True


class EventData(BaseModel):
    id: int
    name: str
    datetime: str
    location: Optional[str]
    tasks: List[TaskData]


class WeekData(BaseModel):
    id: int
    week_number: int
    start_date: str
    end_date: str
    is_current: bool
    events: List[EventData]


class DashboardResponse(BaseModel):
    semester_name: Optional[str]
    semester_id: Optional[int]
    weeks: List[WeekData]
    user_role: str


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get active semester
    semester = db.query(Semester).filter(Semester.is_active == True).first()
    
    if not semester:
        return DashboardResponse(
            semester_name=None,
            semester_id=None,
            weeks=[],
            user_role=current_user.role.value
        )
    
    # Get all weeks in semester
    weeks = db.query(Week).filter(
        Week.semester_id == semester.id
    ).order_by(Week.week_number).all()
    
    today = date.today()
    weeks_data = []
    
    for week in weeks:
        # Check if this is current week
        is_current = week.start_date <= today <= week.end_date
        
        # Get events for this week
        events = db.query(Event).filter(
            Event.week_id == week.id
        ).order_by(Event.datetime).all()
        
        events_data = []
        for event in events:
            # Get tasks with filtering based on user role
            tasks_query = db.query(Task).filter(Task.event_id == event.id)
            
            # Filter tasks based on role
            if current_user.role != Role.ADMIN:
                if current_user.team == Team.MEDIA:
                    # Media team members see their tasks + media team tasks
                    tasks_query = tasks_query.filter(
                        (Task.assigned_to == current_user.id) | 
                        (Task.assigned_team == "MEDIA")
                    )
                else:
                    # Regular members only see their assigned tasks
                    tasks_query = tasks_query.filter(Task.assigned_to == current_user.id)
            
            tasks = tasks_query.all()
            
            tasks_data = []
            for task in tasks:
                # Get assignee name
                assignee_name = None
                if task.assigned_to:
                    assignee = db.query(User).filter(User.id == task.assigned_to).first()
                    assignee_name = assignee.display_name if assignee else None
                elif task.assigned_team:
                    assignee_name = f"{task.assigned_team} Team"
                
                tasks_data.append(TaskData(
                    id=task.id,
                    title=task.title,
                    description=task.description,
                    task_type=task.task_type.value,
                    status=task.status.value,
                    assigned_to=task.assigned_to,
                    assigned_team=task.assigned_team,
                    assignee_name=assignee_name,
                    reminder_time=task.reminder_time.isoformat() if task.reminder_time else None,
                    reminder_sent=task.reminder_sent,
                    cannot_do_reason=task.cannot_do_reason
                ))
            
            # Only include events that have tasks (for non-admins)
            if tasks_data or current_user.role == Role.ADMIN:
                events_data.append(EventData(
                    id=event.id,
                    name=event.name,
                    datetime=event.datetime.isoformat(),
                    location=event.location,
                    tasks=tasks_data
                ))
        
        weeks_data.append(WeekData(
            id=week.id,
            week_number=week.week_number,
            start_date=week.start_date.isoformat(),
            end_date=week.end_date.isoformat(),
            is_current=is_current,
            events=events_data
        ))
    
    return DashboardResponse(
        semester_name=semester.name,
        semester_id=semester.id,
        weeks=weeks_data,
        user_role=current_user.role.value
    )
