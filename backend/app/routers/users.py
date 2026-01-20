from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Role, Team
from app.schemas import UserCreate, UserUpdate, UserOut
from app.middleware.auth import get_admin_user, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


def user_to_out(user: User) -> UserOut:
    """Convert User model to UserOut schema."""
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        discord_id=user.discord_id,
        role=user.role,
        team_id=user.team_id,
        team_name=user.team.name if user.team else None,
        created_at=user.created_at
    )


@router.get("", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    users = db.query(User).all()
    return [user_to_out(u) for u in users]


@router.post("", response_model=UserOut)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        display_name=user_data.display_name,
        discord_id=user_data.discord_id,
        role=user_data.role,
        team_id=user_data.team_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user_to_out(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


class BatchUserItem(BaseModel):
    username: str
    display_name: str
    password: Optional[str] = None  # If not provided, uses username as password
    discord_id: Optional[str] = None
    role: str = "MEMBER"  # ADMIN or MEMBER
    team_id: Optional[int] = None  # Team ID (preferred)
    team_name: Optional[str] = None  # Team name (alternative - will lookup ID)


class BatchUserRequest(BaseModel):
    users: List[BatchUserItem]


class BatchUserResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]


@router.post("/batch", response_model=BatchUserResult)
async def batch_create_users(
    data: BatchUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Batch create multiple users. Skips usernames that already exist."""
    created = 0
    skipped = 0
    errors = []
    
    for item in data.users:
        try:
            # Check if username exists
            if db.query(User).filter(User.username == item.username).first():
                skipped += 1
                continue
            
            # Parse role
            try:
                role = Role[item.role.upper()]
            except KeyError:
                errors.append(f"{item.username}: Invalid role '{item.role}'")
                continue
            
            # Resolve team - prefer team_id, fallback to team_name lookup
            resolved_team_id = item.team_id
            if not resolved_team_id and item.team_name:
                team_name_stripped = item.team_name.strip()
                # Match with trimmed names on both sides
                teams = db.query(Team).all()
                team = next((t for t in teams if t.name.strip().lower() == team_name_stripped.lower()), None)
                if team:
                    resolved_team_id = team.id
                else:
                    errors.append(f"{item.username}: Team '{item.team_name}' not found")
                    continue
            elif resolved_team_id:
                team = db.query(Team).filter(Team.id == resolved_team_id).first()
                if not team:
                    errors.append(f"{item.username}: Invalid team_id '{resolved_team_id}'")
                    continue
            
            # Use username as password if not provided
            password = item.password or item.username
            
            user = User(
                username=item.username,
                password_hash=hash_password(password),
                display_name=item.display_name,
                discord_id=item.discord_id,
                role=role,
                team_id=resolved_team_id
            )
            db.add(user)
            created += 1
            
        except Exception as e:
            errors.append(f"{item.username}: {str(e)}")
    
    db.commit()
    return BatchUserResult(created=created, skipped=skipped, errors=errors)
