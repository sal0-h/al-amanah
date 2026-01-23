from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class TaskType(str, enum.Enum):
    STANDARD = "STANDARD"
    SETUP = "SETUP"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    DONE = "DONE"
    CANNOT_DO = "CANNOT_DO"


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(Enum(TaskType), default=TaskType.STANDARD, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    
    # Assignment options:
    # 1. assigned_to - single user (legacy, still supported)
    # 2. assigned_team_id - assign to team (all members can complete)
    # 3. Use TaskAssignment table for multi-user pool
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    
    # Track who completed the task
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Reminder fields (admin-triggered)
    reminder_time = Column(DateTime(timezone=True), nullable=True)
    reminder_sent = Column(Boolean, default=False, nullable=False)
    
    # Auto day-before reminder
    auto_reminder_sent = Column(Boolean, default=False, nullable=False)
    
    # Cannot do reason
    cannot_do_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="tasks")
    assigned_user = relationship("User", foreign_keys=[assigned_to])  # For eager loading
    completed_user = relationship("User", foreign_keys=[completed_by])  # For eager loading
    assigned_team = relationship("Team")
    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
