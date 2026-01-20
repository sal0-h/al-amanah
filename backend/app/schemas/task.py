from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.task import TaskType, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.STANDARD
    assigned_to: Optional[int] = None  # Single user (legacy)
    assigned_team_id: Optional[int] = None  # Team assignment
    assigned_user_ids: Optional[List[int]] = None  # Multi-user pool


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    assigned_to: Optional[int] = None
    assigned_team_id: Optional[int] = None
    assigned_user_ids: Optional[List[int]] = None


class AssigneeInfo(BaseModel):
    id: int
    display_name: str


class TaskOut(BaseModel):
    id: int
    event_id: int
    title: str
    description: Optional[str] = None
    task_type: TaskType
    status: TaskStatus
    assigned_to: Optional[int] = None
    assigned_team_id: Optional[int] = None
    assignee_name: Optional[str] = None  # Legacy single name or team name
    assignees: List[AssigneeInfo] = []  # Pool of assigned users
    completed_by: Optional[int] = None
    completed_by_name: Optional[str] = None
    reminder_time: Optional[datetime] = None
    reminder_sent: bool = False
    cannot_do_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TaskCannotDo(BaseModel):
    reason: str


class TaskReminder(BaseModel):
    reminder_time: datetime
