import httpx
from app.config import get_settings
import logging
from typing import List

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_reminder(discord_ids: List[str], task_title: str, event_name: str, custom_message: str = None) -> bool:
    """Send a reminder ping to users via Discord webhook."""
    if not settings.REMINDER_WEBHOOK_URL:
        logger.warning("REMINDER_WEBHOOK_URL not configured")
        return False
    
    if not discord_ids:
        logger.warning("No discord IDs provided for reminder")
        return False
    
    # Build mentions string
    mentions = " ".join([f"<@{did}>" for did in discord_ids if did])
    
    if custom_message:
        content = f"{mentions} {custom_message}"
    else:
        content = f"{mentions} ⏰ **Reminder**: Task **'{task_title}'** for event **'{event_name}'** needs your attention!"
    
    message = {
        "content": content,
        "allowed_mentions": {"users": discord_ids}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.REMINDER_WEBHOOK_URL,
                json=message,
                timeout=10.0
            )
            response.raise_for_status()
            logger.info(f"Sent reminder to {len(discord_ids)} users for task: {task_title}")
            return True
    except Exception as e:
        logger.error(f"Failed to send reminder: {e}")
        return False


async def send_admin_alert(
    user_name: str,
    task_title: str,
    event_name: str,
    reason: str
) -> bool:
    """Send an alert to admins when a task is flagged as Cannot Do."""
    if not settings.ADMIN_WEBHOOK_URL:
        logger.warning("ADMIN_WEBHOOK_URL not configured")
        return False
    
    message = {
        "content": (
            f"⚠️ **Task Blocked Alert**\n\n"
            f"**User**: {user_name}\n"
            f"**Task**: {task_title}\n"
            f"**Event**: {event_name}\n"
            f"**Reason**: {reason}"
        )
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.ADMIN_WEBHOOK_URL,
                json=message,
                timeout=10.0
            )
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Failed to send admin alert: {e}")
        return False
