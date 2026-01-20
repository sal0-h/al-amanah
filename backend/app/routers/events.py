from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Event, Week, User
from app.schemas import EventCreate, EventUpdate, EventOut
from app.middleware.auth import get_current_user, get_admin_user

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
