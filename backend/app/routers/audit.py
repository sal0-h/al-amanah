from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import User, AuditLog
from app.middleware.auth import get_admin_user

router = APIRouter(prefix="/api/audit", tags=["audit"])


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None
    user_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    entity_name: str | None
    details: str | None
    ip_address: str | None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogPage(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    per_page: int
    total_pages: int


@router.get("", response_model=AuditLogPage)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=100),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get audit logs with pagination and filtering (admin only)."""
    query = db.query(AuditLog)
    
    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    # Get total count
    total = query.count()
    total_pages = (total + per_page - 1) // per_page
    
    # Paginate
    logs = query.order_by(AuditLog.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()
    
    items = [
        AuditLogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.display_name if log.user else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=log.entity_name,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        )
        for log in logs
    ]
    
    return AuditLogPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/actions", response_model=List[str])
async def get_action_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get unique action types for filtering."""
    actions = db.query(AuditLog.action).distinct().all()
    return [a[0] for a in actions]


@router.get("/entities", response_model=List[str])
async def get_entity_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """Get unique entity types for filtering."""
    entities = db.query(AuditLog.entity_type).distinct().all()
    return [e[0] for e in entities]
