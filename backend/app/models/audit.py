from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    """Audit log tracking all changes in the system."""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, LOGIN, etc.
    entity_type = Column(String(50), nullable=False)  # User, Task, Event, etc.
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(200), nullable=True)  # Human-readable name
    details = Column(Text, nullable=True)  # JSON or text description of changes
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)
    
    # Relationship
    user = relationship("User", back_populates="audit_logs")
