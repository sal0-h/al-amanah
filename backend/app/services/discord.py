import httpx
from app.config import get_settings
import logging
from typing import List
import asyncio

logger = logging.getLogger(__name__)
settings = get_settings()


async def _send_webhook_with_retry(url: str, message: dict, max_retries: int = 3) -> bool:
    """Send webhook with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=message,
                    timeout=10.0
                )
                response.raise_for_status()
                return True
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"Discord webhook attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Discord webhook failed after {max_retries} attempts: {e}")
                return False
    return False


async def send_reminder(discord_ids: List[str], task_title: str, event_name: str, custom_message: str = None) -> bool:
    """Send a reminder ping to users via Discord webhook."""
    if not settings.DISCORD_ENABLED:
        logger.info(f"Discord disabled: skipping reminder for task '{task_title}'")
        return True
    
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
    
    result = await _send_webhook_with_retry(settings.REMINDER_WEBHOOK_URL, message)
    if result:
        logger.info(f"Sent reminder to {len(discord_ids)} users for task: {task_title}")
    return result


async def send_admin_alert(
    user_name: str,
    task_title: str,
    event_name: str,
    reason: str
) -> bool:
    """Send an alert to admins when a task is flagged as Cannot Do."""
    if not settings.DISCORD_ENABLED:
        logger.info(f"Discord disabled: skipping admin alert for task '{task_title}'")
        return True
    
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
    
    return await _send_webhook_with_retry(settings.ADMIN_WEBHOOK_URL, message)
