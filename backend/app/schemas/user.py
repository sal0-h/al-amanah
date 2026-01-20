from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.user import Role


class UserBase(BaseModel):
    username: str
    display_name: str
    discord_id: Optional[str] = None
    role: Role = Role.MEMBER
    team_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    discord_id: Optional[str] = None
    role: Optional[Role] = None
    team_id: Optional[int] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    discord_id: Optional[str] = None
    role: Role
    team_id: Optional[int] = None
    team_name: Optional[str] = None  # Added for convenience
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str
