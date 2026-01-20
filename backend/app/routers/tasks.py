from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Task, Event, User, TaskStatus, Role, Team
from app.schemas import TaskCreate, TaskUpdate, TaskOut, TaskCannotDo, TaskReminder
from app.middleware.auth import get_current_user, get_admin_user
from app.services.discord import send_admin_alert

router = APIRouter(prefix="/api", tags=["tasks"])


def task_to_out(task: Task, db: Session) -> TaskOut:
    """Convert Task model to TaskOut schema with assignee name."""
    assignee_name = None
    if task.assigned_to:
        user = db.query(User).filter(User.id == task.assigned_to).first()
        assignee_name = user.display_name if user else None
    elif task.assigned_team:
        assignee_name = f"{task.assigned_team} Team"
    
    return TaskOut(
        id=task.id,
        event_id=task.event_id,
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        status=task.status,
        assigned_to=task.assigned_to,
        assigned_team=task.assigned_team,
        reminder_time=task.reminder_time,
        reminder_sent=task.reminder_sent,
        cannot_do_reason=task.cannot_do_reason,
        created_at=task.created_at,
        updated_at=task.updated_at,
        assignee_name=assignee_name
    )


@router.get("/events/{event_id}/tasks", response_model=List[TaskOut])
async def list_tasks(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    tasks = db.query(Task).filter(Task.event_id == event_id).all()
    return [task_to_out(t, db) for t in tasks]


@router.post("/events/{event_id}/tasks", response_model=TaskOut)
async def create_task(
    event_id: int,
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    task = Task(event_id=event_id, **task_data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_out(task, db)


@router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task_data.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task_to_out(task, db)


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


def can_modify_task(task: Task, user: User) -> bool:
    """Check if user can modify this task."""
    if user.role == Role.ADMIN:
        return True
    if task.assigned_to == user.id:
        return True
    if task.assigned_team == "MEDIA" and user.team == Team.MEDIA:
        return True
    return False


@router.patch("/tasks/{task_id}/done", response_model=TaskOut)
async def mark_task_done(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_modify_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    task.status = TaskStatus.DONE
    db.commit()
    db.refresh(task)
    return task_to_out(task, db)


@router.patch("/tasks/{task_id}/cannot-do", response_model=TaskOut)
async def mark_task_cannot_do(
    task_id: int,
    data: TaskCannotDo,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_modify_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    task.status = TaskStatus.CANNOT_DO
    task.cannot_do_reason = data.reason
    db.commit()
    db.refresh(task)
    
    # Get event name for alert
    event = db.query(Event).filter(Event.id == task.event_id).first()
    event_name = event.name if event else "Unknown Event"
    
    # Send admin alert in background
    background_tasks.add_task(
        send_admin_alert,
        current_user.display_name,
        task.title,
        event_name,
        data.reason
    )
    
    return task_to_out(task, db)


@router.patch("/tasks/{task_id}/reminder", response_model=TaskOut)
async def set_task_reminder(
    task_id: int,
    data: TaskReminder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_modify_task(task, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    task.reminder_time = data.reminder_time
    task.reminder_sent = False  # Reset in case they're changing it
    db.commit()
    db.refresh(task)
    return task_to_out(task, db)
