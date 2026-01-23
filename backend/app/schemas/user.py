from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re
from app.models.user import Role


class UserBase(BaseModel):
    username: str
    display_name: str
    discord_id: Optional[str] = None
    role: Role = Role.MEMBER
    team_id: Optional[int] = None
    
    @field_validator('discord_id')
    @classmethod
    def validate_discord_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v = v.strip()
            if not re.match(r'^\d{17,20}$', v):
                raise ValueError('Discord ID must be 17-20 digits')
            return v
        return None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    discord_id: Optional[str] = None
    role: Optional[Role] = None
    team_id: Optional[int] = None
    password: Optional[str] = None
    
    @field_validator('discord_id')
    @classmethod
    def validate_discord_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v = v.strip()
            if not re.match(r'^\d{17,20}$', v):
                raise ValueError('Discord ID must be 17-20 digits')
            return v
        return None


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
