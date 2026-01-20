from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    week_id = Column(Integer, ForeignKey("weeks.id"), nullable=False)
    name = Column(String(200), nullable=False)
    datetime = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(200), nullable=True)
    
    week = relationship("Week", back_populates="events")
    tasks = relationship("Task", back_populates="event", cascade="all, delete-orphan")
