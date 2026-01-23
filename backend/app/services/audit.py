from sqlalchemy.orm import Session
from app.models import AuditLog
from typing import Optional
import logging
import json

logger = logging.getLogger(__name__)


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
    
    # Structured logging for external monitoring
    log_data = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": sanitize_for_logging(entity_name) if entity_name else None,
        "user_id": user_id,
        "details": sanitize_for_logging(details) if details else None,
        "ip_address": ip_address
    }
    logger.info(f"AUDIT: {json.dumps(log_data)}")
    
    # Don't commit - let the calling code handle transaction
    return log


def sanitize_for_logging(text: Optional[str]) -> Optional[str]:
    """Remove newlines and control characters to prevent log injection."""
    if not text:
        return None
    # Replace newlines and tabs with spaces
    sanitized = text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    # Remove any other control characters
    sanitized = ''.join(char for char in sanitized if ord(char) >= 32 or char in '\n\r\t')
    return sanitized.strip()
