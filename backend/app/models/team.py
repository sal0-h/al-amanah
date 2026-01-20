from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Team(Base):
    """Dynamic teams that users can belong to."""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # e.g., "Media", "Events", "Outreach"
    color = Column(String(7), nullable=True)  # Hex color for UI, e.g., "#3B82F6"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
