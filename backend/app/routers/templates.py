from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime as dt, timedelta

from app.database import get_db
from app.models import Event, Task, TaskType, TaskStatus, Team, Week
from app.models import EventTemplate as EventTemplateModel
from app.models import WeekTemplate as WeekTemplateModel
from app.models import WeekTemplateEvent as WeekTemplateEventModel
from app.middleware.auth import get_admin_user, User


router = APIRouter(prefix="/api/templates", tags=["templates"])


# ============== SCHEMAS ==============

class TaskTemplateSchema(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "STANDARD"
    assigned_team_name: Optional[str] = None


class EventTemplateOut(BaseModel):
    id: str  # String ID for compatibility (prefixed with 'db_' for DB templates)
    name: str
    tasks: List[TaskTemplateSchema]
    is_custom: bool = False  # True if from DB, False if hardcoded
    is_modified: bool = False  # True if this is a modified version of a default template
    can_reset: bool = False  # True if this template can be reset to default

    class Config:
        from_attributes = True


class EventTemplateCreate(BaseModel):
    name: str
    tasks: List[TaskTemplateSchema] = []


class EventTemplateUpdate(BaseModel):
    name: Optional[str] = None
    tasks: Optional[List[TaskTemplateSchema]] = None


class WeekEventTemplateSchema(BaseModel):
    event_template_id: str
    day_of_week: int  # 0=Sunday, 6=Saturday (aligned to semester start_date)
    default_time: str  # HH:MM format


class WeekTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    events: List[WeekEventTemplateSchema]
    is_custom: bool = False
    is_modified: bool = False  # True if this is a modified version of a default template
    can_reset: bool = False  # True if this template can be reset to default

    class Config:
        from_attributes = True


class WeekTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    events: List[WeekEventTemplateSchema] = []


class WeekTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    events: Optional[List[WeekEventTemplateSchema]] = None


# ============== HARDCODED DEFAULT TEMPLATES ==============

DEFAULT_EVENT_TEMPLATES: List[EventTemplateOut] = [
    EventTemplateOut(
        id="email", name="Weekly Announcement Email", is_custom=False,
        tasks=[
            TaskTemplateSchema(title="Create event poster", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplateSchema(title="Draft email", task_type="STANDARD", assigned_team_name="Secretary"),
            TaskTemplateSchema(title="Review email", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Send email", task_type="STANDARD", assigned_team_name="Secretary"),
        ]
    ),
    EventTemplateOut(
        id="sweet_sunday", name="Sweet Sunday", is_custom=False,
        tasks=[
            TaskTemplateSchema(title="Decide on SS Question", task_type="STANDARD"),
            TaskTemplateSchema(title="Submit Event Form", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Order sweets", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Pick up sweets", task_type="STANDARD"),
            TaskTemplateSchema(title="Shift 1 Person 1", task_type="STANDARD"),
            TaskTemplateSchema(title="Shift 1 Person 2", task_type="STANDARD"),
            TaskTemplateSchema(title="Shift 2 Person 1", task_type="STANDARD"),
            TaskTemplateSchema(title="Shift 2 Person 2", task_type="STANDARD"),
            TaskTemplateSchema(title="Update Budget Tracker & Projection", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Photography", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplateSchema(title="Post on Instagram", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplateOut(
        id="kk", name="Karak & Kookies (K&K)", is_custom=False,
        tasks=[
            TaskTemplateSchema(title="Submit Event Form", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Order kookies", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Decide topic and provide small summary", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 1st floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 2nd floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 3rd floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Sharing poster on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Sending 'Happening Today' reminder on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Picking up kookies", task_type="STANDARD"),
            TaskTemplateSchema(title="Picking up karak", task_type="STANDARD"),
            TaskTemplateSchema(title="Set up seating 1", task_type="SETUP"),
            TaskTemplateSchema(title="Set up seating 2", task_type="SETUP"),
            TaskTemplateSchema(title="Set up speaker", task_type="SETUP"),
            TaskTemplateSchema(title="Update Budget Tracker & Projection", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Submit expense forms for the week", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Create event poster", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplateOut(
        id="speaker_event", name="Speaker Event", is_custom=False,
        tasks=[
            TaskTemplateSchema(title="Confirm speaker & topic", task_type="STANDARD"),
            TaskTemplateSchema(title="Submit Event Form", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Order food", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Setup room & recording", task_type="SETUP"),
            TaskTemplateSchema(title="Sharing poster on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Sending 'Happening Today' reminder on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Picking up food", task_type="STANDARD"),
            TaskTemplateSchema(title="Update Budget Tracker & Projection", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Submit expense forms for the week", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Photography", task_type="STANDARD", assigned_team_name="Media"),
            TaskTemplateSchema(title="Post on social media", task_type="STANDARD", assigned_team_name="Media"),
        ]
    ),
    EventTemplateOut(
        id="dine_reflect", name="Dine & Reflect", is_custom=False,
        tasks=[
            TaskTemplateSchema(title="Submit Event Form", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Order food", task_type="STANDARD", assigned_team_name="Logistics"),
            TaskTemplateSchema(title="Decide video", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 1st floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 2nd floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Hang up posters 3rd floor", task_type="STANDARD"),
            TaskTemplateSchema(title="Sharing poster on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Sending 'Happening Today' reminder on WhatsApp", task_type="STANDARD", assigned_team_name="P/VP"),
            TaskTemplateSchema(title="Picking up food", task_type="STANDARD"),
            TaskTemplateSchema(title="Bring banner", task_type="SETUP"),
            TaskTemplateSchema(title="Update Budget Tracker & Projection", task_type="STANDARD", assigned_team_name="Finance"),
            TaskTemplateSchema(title="Submit expense forms for the week", task_type="STANDARD", assigned_team_name="Finance"),
        ]
    )
]

DEFAULT_WEEK_TEMPLATES: List[WeekTemplateOut] = [
    WeekTemplateOut(
        id="sweet_sunday_kk",
        name="Sweet Sunday + K&K",
        description="Sweet Sunday on Sunday, Karak & Konversations on Thursday",
        is_custom=False,
        events=[
            WeekEventTemplateSchema(
                event_template_id="sweet_sunday",
                day_of_week=0,      # Sunday (week starts Sunday)
                default_time="13:00"
            ),
            WeekEventTemplateSchema(
                event_template_id="kk",
                day_of_week=4,      # Thursday
                default_time="17:30"
            ),
        ]
    ),
    WeekTemplateOut(
        id="sweet_sunday_speaker",
        name="Sweet Sunday + Speaker Event",
        description="Sweet Sunday on Sunday, Speaker Event on Wednesday",
        is_custom=False,
        events=[
            WeekEventTemplateSchema(
                event_template_id="sweet_sunday",
                day_of_week=0,      # Sunday (week starts Sunday)
                default_time="13:00"
            ),
            WeekEventTemplateSchema(
                event_template_id="speaker_event",
                day_of_week=3,      # Wednesday
                default_time="18:00"
            ),
        ]
    ),
    WeekTemplateOut(
        id="sweet_sunday_dine",
        name="Sweet Sunday + Dine & Reflect",
        description="Sweet Sunday on Sunday, Dine & Reflect on Thursday",
        is_custom=False,
        events=[
            WeekEventTemplateSchema(
                event_template_id="sweet_sunday",
                day_of_week=0,      # Sunday (week starts Sunday)
                default_time="13:00"
            ),
            WeekEventTemplateSchema(
                event_template_id="dine_reflect",
                day_of_week=4,      # Thursday
                default_time="17:30"
            ),
        ]
    )
]



# ============== HELPER FUNCTIONS ==============

def _event_name_conflicts(name: str, db: Session, exclude_id: Optional[int] = None, original_default_id: Optional[str] = None) -> bool:
    """Check if an event template name conflicts with existing templates.
    
    Args:
        name: The name to check
        db: Database session
        exclude_id: DB template ID to exclude from check (for updates)
        original_default_id: If provided, this is the default template being overridden,
                            so its name is allowed
    """
    name_lower = name.lower()
    
    # Check against default templates (except the one being overridden)
    for t in DEFAULT_EVENT_TEMPLATES:
        if t.name.lower() == name_lower:
            if original_default_id and t.id == original_default_id:
                continue  # Allow using the same name as the default we're overriding
            return True
    
    # Check against DB templates
    query = db.query(EventTemplateModel).filter(EventTemplateModel.name.ilike(name))
    if exclude_id:
        query = query.filter(EventTemplateModel.id != exclude_id)
    if query.first():
        return True
    
    return False


def _week_name_conflicts(name: str, db: Session, exclude_id: Optional[int] = None, original_default_id: Optional[str] = None) -> bool:
    """Check if a week template name conflicts with existing templates."""
    name_lower = name.lower()
    
    # Check against default templates
    for t in DEFAULT_WEEK_TEMPLATES:
        if t.name.lower() == name_lower:
            if original_default_id and t.id == original_default_id:
                continue
            return True
    
    # Check against DB templates
    query = db.query(WeekTemplateModel).filter(WeekTemplateModel.name.ilike(name))
    if exclude_id:
        query = query.filter(WeekTemplateModel.id != exclude_id)
    if query.first():
        return True
    
    return False


def db_event_template_to_out(t: EventTemplateModel) -> EventTemplateOut:
    """Convert DB EventTemplate to output schema."""
    tasks = [TaskTemplateSchema(**task) for task in (t.tasks_json or [])]
    
    # If this overrides a default, use the default's ID (so it appears as the same template)
    if t.overrides_default_id:
        return EventTemplateOut(
            id=t.overrides_default_id,
            name=t.name,
            tasks=tasks,
            is_custom=False,  # It's still conceptually a "default" template
            is_modified=True,  # But it's been modified
            can_reset=True  # Can reset to original
        )
    
    return EventTemplateOut(
        id=f"db_{t.id}",
        name=t.name,
        tasks=tasks,
        is_custom=True,
        is_modified=False,
        can_reset=False
    )


def db_week_template_to_out(t: WeekTemplateModel) -> WeekTemplateOut:
    """Convert DB WeekTemplate to output schema."""
    events = [
        WeekEventTemplateSchema(
            event_template_id=f"db_{e.event_template_id}" if e.event_template_id else e.event_template_id_str,
            day_of_week=e.day_of_week,
            default_time=e.default_time
        )
        for e in t.events
    ]
    
    # If this overrides a default, use the default's ID
    if t.overrides_default_id:
        return WeekTemplateOut(
            id=t.overrides_default_id,
            name=t.name,
            description=t.description,
            events=events,
            is_custom=False,
            is_modified=True,
            can_reset=True
        )
    
    return WeekTemplateOut(
        id=f"db_{t.id}",
        name=t.name,
        description=t.description,
        events=events,
        is_custom=True,
        is_modified=False,
        can_reset=False
    )


def get_default_event_template_by_id(template_id: str) -> Optional[EventTemplateOut]:
    """Get a hardcoded default event template by ID."""
    for t in DEFAULT_EVENT_TEMPLATES:
        if t.id == template_id:
            return t
    return None


def get_default_week_template_by_id(template_id: str) -> Optional[WeekTemplateOut]:
    """Get a hardcoded default week template by ID."""
    for t in DEFAULT_WEEK_TEMPLATES:
        if t.id == template_id:
            return t
    return None


def get_event_template_by_id(template_id: str, db: Session) -> Optional[EventTemplateOut]:
    """Get event template by ID (checks DB override first, then hardcoded, then custom DB)."""
    # First check if there's a DB override for this ID
    override = db.query(EventTemplateModel).filter(
        EventTemplateModel.overrides_default_id == template_id
    ).first()
    if override:
        return db_event_template_to_out(override)
    
    # Check hardcoded templates
    for t in DEFAULT_EVENT_TEMPLATES:
        if t.id == template_id:
            return t
    
    # Check DB custom templates (ID format: db_<int>)
    if template_id.startswith("db_"):
        db_id = int(template_id[3:])
        t = db.query(EventTemplateModel).filter(EventTemplateModel.id == db_id).first()
        if t:
            return db_event_template_to_out(t)
    
    return None


def get_week_template_by_id(template_id: str, db: Session) -> Optional[WeekTemplateOut]:
    """Get week template by ID (checks DB override first, then hardcoded, then custom DB)."""
    # First check if there's a DB override for this ID
    override = db.query(WeekTemplateModel).filter(
        WeekTemplateModel.overrides_default_id == template_id
    ).first()
    if override:
        return db_week_template_to_out(override)
    
    # Check hardcoded templates
    for t in DEFAULT_WEEK_TEMPLATES:
        if t.id == template_id:
            return t
    
    # Check DB custom templates
    if template_id.startswith("db_"):
        db_id = int(template_id[3:])
        t = db.query(WeekTemplateModel).filter(WeekTemplateModel.id == db_id).first()
        if t:
            return db_week_template_to_out(t)
    
    return None


# ============== EVENT TEMPLATE ENDPOINTS ==============

@router.get("/events", response_model=List[EventTemplateOut])
async def get_event_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get all event templates (hardcoded + custom from DB, with overrides merged)."""
    # Get all DB templates indexed by what they override
    db_templates = db.query(EventTemplateModel).all()
    overrides = {t.overrides_default_id: t for t in db_templates if t.overrides_default_id}
    custom_templates = [t for t in db_templates if not t.overrides_default_id]
    
    templates = []
    
    # Add default templates (or their overrides)
    for default in DEFAULT_EVENT_TEMPLATES:
        if default.id in overrides:
            # Use the override instead
            templates.append(db_event_template_to_out(overrides[default.id]))
        else:
            # Use the original default (with is_modified=False, can_reset=False)
            templates.append(EventTemplateOut(
                id=default.id,
                name=default.name,
                tasks=default.tasks,
                is_custom=False,
                is_modified=False,
                can_reset=False
            ))
    
    # Add custom DB templates
    for t in custom_templates:
        templates.append(db_event_template_to_out(t))
    
    return templates


@router.get("", response_model=List[EventTemplateOut])
async def get_templates_legacy(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Legacy endpoint - same as /events."""
    return await get_event_templates(db, _)


@router.post("/events", response_model=EventTemplateOut)
async def create_event_template(
    data: EventTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create a custom event template."""
    # Check name doesn't conflict with hardcoded
    for t in DEFAULT_EVENT_TEMPLATES:
        if t.name.lower() == data.name.lower():
            raise HTTPException(status_code=400, detail="Name conflicts with default template")
    
    # Check name doesn't exist in DB
    existing = db.query(EventTemplateModel).filter(EventTemplateModel.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    
    template = EventTemplateModel(
        name=data.name,
        tasks_json=[t.model_dump() for t in data.tasks]
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return db_event_template_to_out(template)


@router.put("/events/{template_id}", response_model=EventTemplateOut)
async def update_event_template(
    template_id: str,
    data: EventTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Update an event template (works for both default and custom templates)."""
    # Check if it's a default template
    default_template = get_default_event_template_by_id(template_id)
    
    if default_template:
        # It's a default template - check if override exists
        override = db.query(EventTemplateModel).filter(
            EventTemplateModel.overrides_default_id == template_id
        ).first()
        
        if override:
            # Update existing override
            if data.name is not None and data.name != override.name:
                # Check name doesn't conflict with other templates
                if _event_name_conflicts(data.name, db, exclude_id=override.id, original_default_id=template_id):
                    raise HTTPException(status_code=400, detail="Name conflicts with another template")
                override.name = data.name
            if data.tasks is not None:
                override.tasks_json = [t.model_dump() for t in data.tasks]
            db.commit()
            db.refresh(override)
            return db_event_template_to_out(override)
        else:
            # Create new override
            new_name = data.name if data.name is not None else default_template.name
            new_tasks = [t.model_dump() for t in data.tasks] if data.tasks is not None else [t.model_dump() for t in default_template.tasks]
            
            # Check name doesn't conflict (unless it's the same as the default we're overriding)
            if data.name is not None and _event_name_conflicts(new_name, db, original_default_id=template_id):
                raise HTTPException(status_code=400, detail="Name conflicts with another template")
            
            override = EventTemplateModel(
                name=new_name,
                tasks_json=new_tasks,
                overrides_default_id=template_id
            )
            db.add(override)
            db.commit()
            db.refresh(override)
            return db_event_template_to_out(override)
    
    # Check if it's a custom DB template (db_<id>)
    if template_id.startswith("db_"):
        db_id = int(template_id[3:])
        template = db.query(EventTemplateModel).filter(EventTemplateModel.id == db_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if data.name is not None and data.name != template.name:
            # Check name doesn't conflict
            if _event_name_conflicts(data.name, db, exclude_id=template.id):
                raise HTTPException(status_code=400, detail="Name conflicts with another template")
            template.name = data.name
        if data.tasks is not None:
            template.tasks_json = [t.model_dump() for t in data.tasks]
        
        db.commit()
        db.refresh(template)
        return db_event_template_to_out(template)
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/events/{template_id}/reset", response_model=EventTemplateOut)
async def reset_event_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Reset a modified default template back to its original state."""
    # Check if this is a valid default template
    default_template = get_default_event_template_by_id(template_id)
    if not default_template:
        raise HTTPException(status_code=400, detail="Can only reset default templates")
    
    # Find and delete the override
    override = db.query(EventTemplateModel).filter(
        EventTemplateModel.overrides_default_id == template_id
    ).first()
    
    if not override:
        raise HTTPException(status_code=400, detail="Template is not modified, nothing to reset")
    
    db.delete(override)
    db.commit()
    
    # Return the original default template
    return EventTemplateOut(
        id=default_template.id,
        name=default_template.name,
        tasks=default_template.tasks,
        is_custom=False,
        is_modified=False,
        can_reset=False
    )


@router.delete("/events/{template_id}")
async def delete_event_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Delete a custom event template (cannot delete default templates)."""
    # Check if it's a default template
    if get_default_event_template_by_id(template_id):
        raise HTTPException(status_code=400, detail="Cannot delete default templates. Use reset to restore original.")
    
    # Must be a custom DB template
    if not template_id.startswith("db_"):
        raise HTTPException(status_code=404, detail="Template not found")
    
    db_id = int(template_id[3:])
    template = db.query(EventTemplateModel).filter(EventTemplateModel.id == db_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow deleting overrides via this endpoint
    if template.overrides_default_id:
        raise HTTPException(status_code=400, detail="Cannot delete default templates. Use reset to restore original.")
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}


# ============== WEEK TEMPLATE ENDPOINTS ==============

@router.get("/weeks", response_model=List[WeekTemplateOut])
async def get_week_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get all week templates (hardcoded + custom from DB, with overrides merged)."""
    # Get all DB templates indexed by what they override
    db_templates = db.query(WeekTemplateModel).all()
    overrides = {t.overrides_default_id: t for t in db_templates if t.overrides_default_id}
    custom_templates = [t for t in db_templates if not t.overrides_default_id]
    
    templates = []
    
    # Add default templates (or their overrides)
    for default in DEFAULT_WEEK_TEMPLATES:
        if default.id in overrides:
            templates.append(db_week_template_to_out(overrides[default.id]))
        else:
            templates.append(WeekTemplateOut(
                id=default.id,
                name=default.name,
                description=default.description,
                events=default.events,
                is_custom=False,
                is_modified=False,
                can_reset=False
            ))
    
    # Add custom DB templates
    for t in custom_templates:
        templates.append(db_week_template_to_out(t))
    
    return templates


@router.post("/weeks", response_model=WeekTemplateOut)
async def create_week_template(
    data: WeekTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create a custom week template."""
    for t in DEFAULT_WEEK_TEMPLATES:
        if t.name.lower() == data.name.lower():
            raise HTTPException(status_code=400, detail="Name conflicts with default template")
    
    existing = db.query(WeekTemplateModel).filter(WeekTemplateModel.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    
    template = WeekTemplateModel(
        name=data.name,
        description=data.description
    )
    db.add(template)
    db.flush()
    
    for event_data in data.events:
        event_template_id = event_data.event_template_id
        db_event_id = None
        event_template_id_str = None
        
        if event_template_id.startswith("db_"):
            db_event_id = int(event_template_id[3:])
        else:
            # Store string ID for hardcoded templates
            event_template_id_str = event_template_id
        
        event = WeekTemplateEventModel(
            week_template_id=template.id,
            event_template_id=db_event_id,
            event_template_id_str=event_template_id_str,
            day_of_week=event_data.day_of_week,
            default_time=event_data.default_time
        )
        db.add(event)
    
    db.commit()
    db.refresh(template)
    return db_week_template_to_out(template)


def _save_week_template_events(db: Session, template_id: int, events: List[WeekEventTemplateSchema]):
    """Helper to save week template events."""
    for event_data in events:
        db_event_id = None
        event_template_id_str = None
        
        if event_data.event_template_id.startswith("db_"):
            db_event_id = int(event_data.event_template_id[3:])
        else:
            event_template_id_str = event_data.event_template_id
        
        event = WeekTemplateEventModel(
            week_template_id=template_id,
            event_template_id=db_event_id,
            event_template_id_str=event_template_id_str,
            day_of_week=event_data.day_of_week,
            default_time=event_data.default_time
        )
        db.add(event)


@router.put("/weeks/{template_id}", response_model=WeekTemplateOut)
async def update_week_template(
    template_id: str,
    data: WeekTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Update a week template (works for both default and custom templates)."""
    # Check if it's a default template
    default_template = get_default_week_template_by_id(template_id)
    
    if default_template:
        # It's a default template - check if override exists
        override = db.query(WeekTemplateModel).filter(
            WeekTemplateModel.overrides_default_id == template_id
        ).first()
        
        if override:
            # Update existing override
            if data.name is not None and data.name != override.name:
                if _week_name_conflicts(data.name, db, exclude_id=override.id, original_default_id=template_id):
                    raise HTTPException(status_code=400, detail="Name conflicts with another template")
                override.name = data.name
            if data.description is not None:
                override.description = data.description
            
            if data.events is not None:
                # Clear existing events and add new ones
                db.query(WeekTemplateEventModel).filter(
                    WeekTemplateEventModel.week_template_id == override.id
                ).delete()
                _save_week_template_events(db, override.id, data.events)
            
            db.commit()
            db.refresh(override)
            return db_week_template_to_out(override)
        else:
            # Create new override
            new_name = data.name if data.name is not None else default_template.name
            new_description = data.description if data.description is not None else default_template.description
            
            # Check name doesn't conflict
            if data.name is not None and _week_name_conflicts(new_name, db, original_default_id=template_id):
                raise HTTPException(status_code=400, detail="Name conflicts with another template")
            
            override = WeekTemplateModel(
                name=new_name,
                description=new_description,
                overrides_default_id=template_id
            )
            db.add(override)
            db.flush()
            
            # Copy events from default or use provided ones
            events_to_save = data.events if data.events is not None else default_template.events
            _save_week_template_events(db, override.id, events_to_save)
            
            db.commit()
            db.refresh(override)
            return db_week_template_to_out(override)
    
    # Check if it's a custom DB template (db_<id>)
    if template_id.startswith("db_"):
        db_id = int(template_id[3:])
        template = db.query(WeekTemplateModel).filter(WeekTemplateModel.id == db_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if data.name is not None and data.name != template.name:
            if _week_name_conflicts(data.name, db, exclude_id=template.id):
                raise HTTPException(status_code=400, detail="Name conflicts with another template")
            template.name = data.name
        if data.description is not None:
            template.description = data.description
        
        if data.events is not None:
            db.query(WeekTemplateEventModel).filter(
                WeekTemplateEventModel.week_template_id == db_id
            ).delete()
            _save_week_template_events(db, template.id, data.events)
        
        db.commit()
        db.refresh(template)
        return db_week_template_to_out(template)
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/weeks/{template_id}/reset", response_model=WeekTemplateOut)
async def reset_week_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Reset a modified default week template back to its original state."""
    # Check if this is a valid default template
    default_template = get_default_week_template_by_id(template_id)
    if not default_template:
        raise HTTPException(status_code=400, detail="Can only reset default templates")
    
    # Find and delete the override
    override = db.query(WeekTemplateModel).filter(
        WeekTemplateModel.overrides_default_id == template_id
    ).first()
    
    if not override:
        raise HTTPException(status_code=400, detail="Template is not modified, nothing to reset")
    
    db.delete(override)
    db.commit()
    
    # Return the original default template
    return WeekTemplateOut(
        id=default_template.id,
        name=default_template.name,
        description=default_template.description,
        events=default_template.events,
        is_custom=False,
        is_modified=False,
        can_reset=False
    )


@router.delete("/weeks/{template_id}")
async def delete_week_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Delete a custom week template (cannot delete default templates)."""
    # Check if it's a default template
    if get_default_week_template_by_id(template_id):
        raise HTTPException(status_code=400, detail="Cannot delete default templates. Use reset to restore original.")
    
    # Must be a custom DB template
    if not template_id.startswith("db_"):
        raise HTTPException(status_code=404, detail="Template not found")
    
    db_id = int(template_id[3:])
    template = db.query(WeekTemplateModel).filter(WeekTemplateModel.id == db_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow deleting overrides via this endpoint
    if template.overrides_default_id:
        raise HTTPException(status_code=400, detail="Cannot delete default templates. Use reset to restore original.")
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}


# ============== CREATE FROM TEMPLATE ==============

class CreateFromTemplateRequest(BaseModel):
    template_id: str
    week_id: int
    datetime: str
    event_name: Optional[str] = None


@router.post("/create")
async def create_from_template(
    data: CreateFromTemplateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create an event with tasks from a template."""
    template = get_event_template_by_id(data.template_id, db)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Pre-validate all teams exist
    missing_teams = []
    team_cache = {}
    for task_tmpl in template.tasks:
        if task_tmpl.assigned_team_name and task_tmpl.assigned_team_name not in team_cache:
            team = db.query(Team).filter(Team.name.ilike(task_tmpl.assigned_team_name)).first()
            if team:
                team_cache[task_tmpl.assigned_team_name] = team.id
            else:
                missing_teams.append(task_tmpl.assigned_team_name)
    
    if missing_teams:
        raise HTTPException(
            status_code=400, 
            detail=f"Teams not found: {', '.join(missing_teams)}. Create teams before using template."
        )
    
    try:
        event_datetime = dt.fromisoformat(data.datetime.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    event = Event(
        week_id=data.week_id,
        name=data.event_name or template.name,
        datetime=event_datetime
    )
    db.add(event)
    db.flush()
    
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


class CreateFromWeekTemplateRequest(BaseModel):
    week_template_id: str
    week_id: int


@router.post("/weeks/create")
async def create_from_week_template(
    data: CreateFromWeekTemplateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Create multiple events from a week template."""
    week_template = get_week_template_by_id(data.week_template_id, db)
    if not week_template:
        raise HTTPException(status_code=404, detail="Week template not found")
    
    week = db.query(Week).filter(Week.id == data.week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    
    team_cache = {}
    for week_event in week_template.events:
        event_template = get_event_template_by_id(week_event.event_template_id, db)
        if event_template:
            for task_tmpl in event_template.tasks:
                if task_tmpl.assigned_team_name and task_tmpl.assigned_team_name not in team_cache:
                    team = db.query(Team).filter(Team.name.ilike(task_tmpl.assigned_team_name)).first()
                    team_cache[task_tmpl.assigned_team_name] = team.id if team else None
    
    created_events = []
    
    for week_event in week_template.events:
        event_template = get_event_template_by_id(week_event.event_template_id, db)
        if not event_template:
            continue
        
        event_date = week.start_date + timedelta(days=week_event.day_of_week)
        hour, minute = map(int, week_event.default_time.split(':'))
        event_datetime = dt(event_date.year, event_date.month, event_date.day, hour, minute)
        
        event = Event(
            week_id=data.week_id,
            name=event_template.name,
            datetime=event_datetime
        )
        db.add(event)
        db.flush()
        
        for task_tmpl in event_template.tasks:
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
        
        created_events.append(event_template.name)
    
    db.commit()
    
    return {
        "message": f"Created {len(created_events)} events from week template",
        "events": created_events
    }
