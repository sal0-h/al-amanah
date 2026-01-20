from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.user import Role, Team


class UserBase(BaseModel):
    username: str
    display_name: str
    discord_id: Optional[str] = None
    role: Role = Role.MEMBER
    team: Optional[Team] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    discord_id: Optional[str] = None
    role: Optional[Role] = None
    team: Optional[Team] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str
