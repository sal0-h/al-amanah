from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging
import asyncio

from app.database import SessionLocal
from app.models import Task, TaskStatus, User, Event, Team
from app.services.discord import send_reminder

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def check_reminders():
    """Check for tasks with pending reminders and send them."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Get tasks where reminder time has passed but not sent
        tasks = db.query(Task).filter(
            Task.reminder_time <= now,
            Task.reminder_sent == False,
            Task.status == TaskStatus.PENDING
        ).all()
        
        for task in tasks:
            event = db.query(Event).filter(Event.id == task.event_id).first()
            event_name = event.name if event else "Unknown Event"
            
            users_to_notify = []
            
            if task.assigned_to:
                # Individual assignment
                user = db.query(User).filter(User.id == task.assigned_to).first()
                if user and user.discord_id:
                    users_to_notify.append(user)
            elif task.assigned_team == "MEDIA":
                # Team assignment - notify all media members
                media_users = db.query(User).filter(User.team == Team.MEDIA).all()
                users_to_notify.extend([u for u in media_users if u.discord_id])
            
            # Send reminders
            for user in users_to_notify:
                await send_reminder(user.discord_id, task.title, event_name)
            
            # Mark as sent
            task.reminder_sent = True
            db.commit()
            logger.info(f"Sent reminder for task {task.id}: {task.title}")
            
    except Exception as e:
        logger.error(f"Error in reminder check: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with reminder job."""
    scheduler.add_job(
        lambda: asyncio.create_task(check_reminders()),
        IntervalTrigger(minutes=1),
        id="reminder_checker",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - checking reminders every minute")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler stopped")
