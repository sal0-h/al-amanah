from pydantic import BaseModel
from typing import Optional
from datetime import date


class WeekBase(BaseModel):
    week_number: int
    start_date: date
    end_date: date


class WeekCreate(WeekBase):
    pass


class WeekUpdate(BaseModel):
    week_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class WeekOut(WeekBase):
    id: int
    semester_id: int
    
    class Config:
        from_attributes = True
