from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import logging
import asyncio

from app.database import SessionLocal
from app.models import Task, TaskStatus, User, Event, Team, Week, TaskAssignment
from app.services.discord import send_reminder

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def check_auto_reminders():
    """Check for tasks that need automatic day-before event reminders."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(days=1)
        
        # Get all pending tasks for events happening tomorrow
        tasks = db.query(Task).join(Event).filter(
            Task.status == TaskStatus.PENDING,
            Task.auto_reminder_sent == False,
            Event.datetime >= now,
            Event.datetime <= tomorrow
        ).all()
        
        for task in tasks:
            event = db.query(Event).filter(Event.id == task.event_id).first()
            if not event:
                continue
                
            event_name = event.name
            discord_ids = []
            
            # Single user assignment
            if task.assigned_to:
                user = db.query(User).filter(User.id == task.assigned_to).first()
                if user and user.discord_id:
                    discord_ids.append(user.discord_id)
            
            # Team assignment
            if task.assigned_team_id:
                team_users = db.query(User).filter(User.team_id == task.assigned_team_id).all()
                discord_ids.extend([u.discord_id for u in team_users if u.discord_id])
            
            # Multi-user pool
            for assignment in task.assignments:
                if assignment.user and assignment.user.discord_id:
                    if assignment.user.discord_id not in discord_ids:
                        discord_ids.append(assignment.user.discord_id)
            
            if discord_ids:
                await send_reminder(
                    discord_ids, 
                    task.title, 
                    event_name,
                    f"📅 **Auto Reminder**: The event **'{event_name}'** is tomorrow! Task **'{task.title}'** still needs to be completed."
                )
                task.auto_reminder_sent = True
                db.commit()
                logger.info(f"Sent auto day-before reminder for task {task.id}: {task.title}")
            
    except Exception as e:
        logger.error(f"Error in auto reminder check: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with reminder jobs."""
    # Check auto reminders every hour
    scheduler.add_job(
        lambda: asyncio.create_task(check_auto_reminders()),
        IntervalTrigger(hours=1),
        id="auto_reminder_checker",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - checking auto reminders every hour")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler stopped")
