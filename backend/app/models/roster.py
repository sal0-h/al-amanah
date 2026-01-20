from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class RosterMember(Base):
    """Links users to semesters - determines which users are part of each semester's roster."""
    __tablename__ = "roster_members"
    
    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Ensure a user can only be in a semester once
    __table_args__ = (UniqueConstraint('semester_id', 'user_id', name='uq_semester_user'),)
