from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TaskAssignment(Base):
    """Junction table linking tasks to multiple users - enables pool assignments."""
    __tablename__ = "task_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Prevent duplicate assignments
    __table_args__ = (UniqueConstraint('task_id', 'user_id', name='uq_task_user'),)
    
    # Relationships
    task = relationship("Task", back_populates="assignments")
    user = relationship("User")
