from sqlalchemy.orm import Session
from app.models import AuditLog
from typing import Optional


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """
    Log an action to the audit log.
    
    Common actions:
    - CREATE, UPDATE, DELETE
    - LOGIN, LOGOUT
    - TASK_DONE, TASK_CANNOT_DO, TASK_UNDO
    - PASSWORD_CHANGE
    
    Common entity types:
    - user, semester, week, event, task, team, template
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    # Don't commit - let the calling code handle transaction
    return log
