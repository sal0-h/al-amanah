from pydantic import BaseModel, field_validator
from typing import Optional, Union
from datetime import datetime as dt


class EventBase(BaseModel):
    name: str
    datetime: dt
    
    @field_validator('datetime', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        if isinstance(v, str):
            # Handle datetime-local format (no seconds/timezone)
            if len(v) == 16:  # "2026-01-29T12:00"
                v = v + ":00"
            return dt.fromisoformat(v.replace('Z', '+00:00'))
        return v


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    datetime: Optional[dt] = None
    
    @field_validator('datetime', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            # Handle datetime-local format (no seconds/timezone)
            if len(v) == 16:  # "2026-01-29T12:00"
                v = v + ":00"
            return dt.fromisoformat(v.replace('Z', '+00:00'))
        return v


class EventOut(EventBase):
    id: int
    week_id: int
    
    class Config:
        from_attributes = True
