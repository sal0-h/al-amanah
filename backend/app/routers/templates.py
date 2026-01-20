from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime as dt

from app.database import get_db
from app.models import Event, Task, TaskType, TaskStatus, Team
from app.middleware.auth import get_admin_user, User


router = APIRouter(prefix="/api/templates", tags=["templates"])


class TaskTemplate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "STANDARD"
    assigned_team_name: Optional[str] = None  # Team name like "Media"


class EventTemplate(BaseModel):
    id: str
    name: str
    default_location: Optional[str] = None
    tasks: List[TaskTemplate]


# Predefined MSA Event Templates
EVENT_TEMPLATES: List[EventTemplate] = [
    EventTemplate(
        id="jumuah",
        name="Jumuah Prayer",
        default_location="HBKU Mosque",
        tasks=[
            TaskTemplate(title="Send email reminder (Thursday)", task_type="STANDARD"),
            TaskTemplate(title="Prepare khutbah slides", task_type="STANDARD"),
            TaskTemplate(title="Setup audio equipment", task_type="SETUP"),
            TaskTemplate(title="Arrange prayer rugs", task_type="SETUP"),
            TaskTemplate(title="Photography/Recording", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplate(
        id="halaqa",
        name="Weekly Halaqa",
        default_location="LAS 2001",
        tasks=[
            TaskTemplate(title="Confirm speaker/topic", task_type="STANDARD"),
            TaskTemplate(title="Post social media announcement", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Setup chairs & projector", task_type="SETUP"),
            TaskTemplate(title="Prepare refreshments", task_type="STANDARD"),
        ]
    ),
    EventTemplate(
        id="sweet_sunday",
        name="Sweet Sunday",
        default_location="UC Black Box",
        tasks=[
            TaskTemplate(title="Order desserts/snacks", task_type="STANDARD"),
            TaskTemplate(title="Create event poster", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Post on Instagram", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Setup tables & decorations", task_type="SETUP"),
            TaskTemplate(title="Photography", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplate(
        id="kk",
        name="Karak & Konversations (K&K)",
        default_location="TBD",
        tasks=[
            TaskTemplate(title="Book venue", task_type="STANDARD"),
            TaskTemplate(title="Order karak/snacks", task_type="STANDARD"),
            TaskTemplate(title="Prepare discussion topics", task_type="STANDARD"),
            TaskTemplate(title="Create event poster", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Send email blast", task_type="STANDARD"),
        ]
    ),
    EventTemplate(
        id="email_announcement",
        name="Weekly Email Announcement",
        tasks=[
            TaskTemplate(title="Collect updates from board members", task_type="STANDARD"),
            TaskTemplate(title="Draft email content", task_type="STANDARD"),
            TaskTemplate(title="Design email graphics", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Send via mailing list", task_type="STANDARD"),
        ]
    ),
    EventTemplate(
        id="eid_prep",
        name="Eid Celebration",
        default_location="HBKU Student Center",
        tasks=[
            TaskTemplate(title="Book venue", task_type="STANDARD"),
            TaskTemplate(title="Plan menu & order food", task_type="STANDARD"),
            TaskTemplate(title="Create Eid poster", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Send invitations", task_type="STANDARD"),
            TaskTemplate(title="Setup decorations", task_type="SETUP"),
            TaskTemplate(title="Arrange seating", task_type="SETUP"),
            TaskTemplate(title="Photography & video", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Post event recap", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplate(
        id="iftar",
        name="Community Iftar",
        default_location="HBKU Mosque",
        tasks=[
            TaskTemplate(title="Order food", task_type="STANDARD"),
            TaskTemplate(title="Coordinate volunteers", task_type="STANDARD"),
            TaskTemplate(title="Setup food stations", task_type="SETUP"),
            TaskTemplate(title="Prepare dates & water", task_type="SETUP"),
            TaskTemplate(title="Photography", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplate(title="Cleanup coordination", task_type="STANDARD"),
        ]
    ),
    EventTemplate(
        id="custom",
        name="Custom Event",
        tasks=[]
    ),
]


@router.get("", response_model=List[EventTemplate])
async def get_templates(_: User = Depends(get_admin_user)):
    """Get all available event templates (admin only)."""
    return EVENT_TEMPLATES


class CreateFromTemplateRequest(BaseModel):
    template_id: str
    week_id: int
    datetime: str
    location: Optional[str] = None
    event_name: Optional[str] = None  # Override template name


@router.post("/create")
async def create_from_template(
    data: CreateFromTemplateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create an event with tasks from a template."""
    template = next((t for t in EVENT_TEMPLATES if t.id == data.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build a cache of team names to IDs
    team_cache = {}
    for task_tmpl in template.tasks:
        if task_tmpl.assigned_team_name and task_tmpl.assigned_team_name not in team_cache:
            team = db.query(Team).filter(Team.name.ilike(task_tmpl.assigned_team_name)).first()
            team_cache[task_tmpl.assigned_team_name] = team.id if team else None
    
    # Parse datetime string to datetime object
    try:
        event_datetime = dt.fromisoformat(data.datetime.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    # Create event
    event = Event(
        week_id=data.week_id,
        name=data.event_name or template.name,
        datetime=event_datetime,
        location=data.location or template.default_location
    )
    db.add(event)
    db.flush()  # Get event.id
    
    # Create tasks from template
    for task_tmpl in template.tasks:
        assigned_team_id = None
        if task_tmpl.assigned_team_name:
            assigned_team_id = team_cache.get(task_tmpl.assigned_team_name)
        
        task = Task(
            event_id=event.id,
            title=task_tmpl.title,
            description=task_tmpl.description,
            task_type=TaskType[task_tmpl.task_type],
            status=TaskStatus.PENDING,
            assigned_team_id=assigned_team_id
        )
        db.add(task)
    
    db.commit()
    db.refresh(event)
    
    return {
        "message": f"Created event '{event.name}' with {len(template.tasks)} tasks",
        "event_id": event.id
    }
