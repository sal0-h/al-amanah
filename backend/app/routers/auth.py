from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserOut
from app.config import get_settings
from app.middleware.auth import (
    verify_password,
    hash_password,
    create_session_token, 
    get_current_user,
    SESSION_MAX_AGE
)

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def is_https_request(request: Request) -> bool:
    """Detect HTTPS from Cloudflare headers or settings."""
    # Check Cloudflare header first (cf-visitor contains {"scheme":"https"})
    cf_visitor = request.headers.get('cf-visitor', '')
    if '"scheme":"https"' in cf_visitor or '"scheme": "https"' in cf_visitor:
        return True
    # Check X-Forwarded-Proto header (standard reverse proxy)
    if request.headers.get('x-forwarded-proto', '').lower() == 'https':
        return True
    # Fallback to manual setting
    return settings.USE_HTTPS


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


@router.post("/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute (prevents brute force)
async def login(request: Request, credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_session_token(user.id)
    
    # Auto-detect HTTPS from Cloudflare or proxy headers
    use_secure = is_https_request(request)
    
    response.set_cookie(
        key="session",
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=use_secure,  # Auto-detected from headers
        domain=None  # None = current domain only (works for subdomains with explicit domain if needed)
    )
    
    return {"message": "Login successful", "user": user_to_out(user)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return user_to_out(current_user)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change the current user's password."""
    # Verify current password
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
