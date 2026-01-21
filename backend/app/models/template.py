from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EventTemplate(Base):
    """Custom event template with predefined tasks."""
    __tablename__ = "event_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    
    # Store tasks as JSON array: [{"title": "...", "description": "...", "task_type": "STANDARD", "assigned_team_name": "Media"}]
    tasks_json = Column(JSON, default=list)
    
    # Relationship to week template events
    week_template_events = relationship("WeekTemplateEvent", back_populates="event_template", cascade="all, delete-orphan")


class WeekTemplate(Base):
    """Week template containing multiple events scheduled on specific days."""
    __tablename__ = "week_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    # Relationship to events in this week template
    events = relationship("WeekTemplateEvent", back_populates="week_template", cascade="all, delete-orphan")


class WeekTemplateEvent(Base):
    """Junction table linking week templates to event templates with scheduling info."""
    __tablename__ = "week_template_events"
    
    id = Column(Integer, primary_key=True, index=True)
    week_template_id = Column(Integer, ForeignKey("week_templates.id"), nullable=False)
    
    # For custom DB templates, use event_template_id FK
    event_template_id = Column(Integer, ForeignKey("event_templates.id"), nullable=True)
    # For hardcoded templates, store string ID (e.g., "jumuah", "sweet_sunday")
    event_template_id_str = Column(String(50), nullable=True)
    
    # Scheduling
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    default_time = Column(String(5), nullable=False)  # HH:MM format
    
    # Relationships
    week_template = relationship("WeekTemplate", back_populates="events")
    event_template = relationship("EventTemplate", back_populates="week_template_events")
