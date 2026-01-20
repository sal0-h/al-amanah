from fastapi import HTTPException, Depends
from fastapi.security import APIKeyCookie
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.config import get_settings
from app.database import get_db
from app.models import User, Role

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
cookie_scheme = APIKeyCookie(name="session", auto_error=False)

SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_session_token(user_id: int) -> str:
    return serializer.dumps({"user_id": user_id})


def verify_session_token(token: str) -> dict | None:
    try:
        data = serializer.loads(token, max_age=SESSION_MAX_AGE)
        return data
    except (BadSignature, SignatureExpired):
        return None


async def get_current_user(
    session: str = Depends(cookie_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = verify_session_token(session)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    user = db.query(User).filter(User.id == data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
