from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.task import TaskType, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.STANDARD
    assigned_to: Optional[int] = None
    assigned_team: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    assigned_to: Optional[int] = None
    assigned_team: Optional[str] = None


class TaskOut(TaskBase):
    id: int
    event_id: int
    status: TaskStatus
    reminder_time: Optional[datetime] = None
    reminder_sent: bool
    cannot_do_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    assignee_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class TaskCannotDo(BaseModel):
    reason: str


class TaskReminder(BaseModel):
    reminder_time: datetime
