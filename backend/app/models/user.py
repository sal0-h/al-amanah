from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class Team(str, enum.Enum):
    MEDIA = "MEDIA"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    discord_id = Column(String(20), nullable=True)
    role = Column(Enum(Role), default=Role.MEMBER, nullable=False)
    team = Column(Enum(Team), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
