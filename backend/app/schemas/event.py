from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EventBase(BaseModel):
    name: str
    datetime: datetime
    location: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    datetime: Optional[datetime] = None
    location: Optional[str] = None


class EventOut(EventBase):
    id: int
    week_id: int
    
    class Config:
        from_attributes = True
