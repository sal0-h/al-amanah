from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Event, Week, User, Task, TaskStatus, TaskType, TaskAssignment
from app.schemas import EventCreate, EventUpdate, EventOut
from app.middleware.auth import get_current_user, get_admin_user
from app.services.discord import send_reminder

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/weeks/{week_id}/events", response_model=List[EventOut])
async def list_events(
    week_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    
    return db.query(Event).filter(Event.week_id == week_id).order_by(Event.datetime).all()


@router.post("/weeks/{week_id}/events", response_model=EventOut)
async def create_event(
    week_id: int,
    event_data: EventCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    
    event = Event(week_id=week_id, **event_data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=EventOut)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    import logging
    logging.info(f"Updating event {event_id} with data: {event_data.model_dump()}")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    for key, value in event_data.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


@router.post("/events/{event_id}/send-all-reminders")
async def send_event_reminders(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Send reminders to all users with pending tasks for this event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get all pending standard tasks for this event
    pending_tasks = db.query(Task).filter(
        Task.event_id == event_id,
        Task.status == TaskStatus.PENDING,
        Task.task_type == TaskType.STANDARD
    ).all()
    
    if not pending_tasks:
        return {"message": "No pending tasks to remind about", "reminders_sent": 0}
    
    # Collect all user discord IDs to notify (keyed by task for personalized messages)
    reminders_sent = 0
    
    for task in pending_tasks:
        discord_ids = []
        
        # Single user assignment
        if task.assigned_to:
            user = db.query(User).filter(User.id == task.assigned_to).first()
            if user and user.discord_id:
                discord_ids.append(user.discord_id)
        
        # Team assignment
        if task.assigned_team_id:
            team_users = db.query(User).filter(User.team_id == task.assigned_team_id).all()
            for u in team_users:
                if u.discord_id and u.discord_id not in discord_ids:
                    discord_ids.append(u.discord_id)
        
        # Multi-user pool
        for assignment in task.assignments:
            if assignment.user and assignment.user.discord_id:
                if assignment.user.discord_id not in discord_ids:
                    discord_ids.append(assignment.user.discord_id)
        
        if discord_ids:
            background_tasks.add_task(
                send_reminder,
                discord_ids,
                task.title,
                event.name,
                None
            )
            reminders_sent += 1
    
    return {
        "message": f"Sending reminders for {reminders_sent} pending tasks",
        "reminders_sent": reminders_sent
    }
