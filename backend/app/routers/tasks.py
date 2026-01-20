from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.models import Task, Event, User, TaskStatus, Role, Team, TaskAssignment
from app.schemas import TaskCreate, TaskUpdate, TaskOut, TaskCannotDo, TaskReminder
from app.schemas.task import AssigneeInfo
from app.middleware.auth import get_current_user, get_admin_user
from app.services.discord import send_admin_alert, send_reminder
from app.services.audit import log_action

router = APIRouter(prefix="/api", tags=["tasks"])


def task_to_out(task: Task, db: Session) -> TaskOut:
    """Convert Task model to TaskOut schema with assignee info."""
    assignee_name = None
    assignees = []
    
    # Single user assignment
    if task.assigned_to:
        user = db.query(User).filter(User.id == task.assigned_to).first()
        if user:
            assignee_name = user.display_name
            assignees.append(AssigneeInfo(id=user.id, display_name=user.display_name))
    
    # Team assignment
    if task.assigned_team_id:
        team = db.query(Team).filter(Team.id == task.assigned_team_id).first()
        if team:
            assignee_name = f"{team.name} Team"
            # Get all users in this team
            team_users = db.query(User).filter(User.team_id == task.assigned_team_id).all()
            for u in team_users:
                if not any(a.id == u.id for a in assignees):
                    assignees.append(AssigneeInfo(id=u.id, display_name=u.display_name))
    
    # Multi-user pool assignments
    for assignment in task.assignments:
        user = assignment.user
        if user and not any(a.id == user.id for a in assignees):
            assignees.append(AssigneeInfo(id=user.id, display_name=user.display_name))
        if not assignee_name and len(assignees) == 1:
            assignee_name = user.display_name if user else None
        elif not assignee_name and len(assignees) > 1:
            assignee_name = f"{len(assignees)} people"
    
    # Get completer name
    completed_by_name = None
    if task.completed_by:
        completer = db.query(User).filter(User.id == task.completed_by).first()
        completed_by_name = completer.display_name if completer else None
    
    return TaskOut(
        id=task.id,
        event_id=task.event_id,
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        status=task.status,
        assigned_to=task.assigned_to,
        assigned_team_id=task.assigned_team_id,
        assignee_name=assignee_name,
        assignees=assignees,
        completed_by=task.completed_by,
        completed_by_name=completed_by_name,
        reminder_time=task.reminder_time,
        reminder_sent=task.reminder_sent,
        cannot_do_reason=task.cannot_do_reason,
        created_at=task.created_at,
        updated_at=task.updated_at
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
    
    # Extract multi-user IDs before creating task
    assigned_user_ids = task_data.assigned_user_ids or []
    task_dict = task_data.model_dump(exclude={"assigned_user_ids"})
    
    task = Task(event_id=event_id, **task_dict)
    db.add(task)
    db.flush()  # Get task.id
    
    # Add multi-user pool assignments
    for user_id in assigned_user_ids:
        assignment = TaskAssignment(task_id=task.id, user_id=user_id)
        db.add(assignment)
    
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
    
    # Handle multi-user assignments separately
    assigned_user_ids = task_data.assigned_user_ids
    update_dict = task_data.model_dump(exclude={"assigned_user_ids"}, exclude_unset=True)
    
    # Check if assignment is changing - if so, reset status to PENDING
    assignment_changed = False
    if "assigned_to" in update_dict and update_dict["assigned_to"] != task.assigned_to:
        assignment_changed = True
    if "assigned_team_id" in update_dict and update_dict["assigned_team_id"] != task.assigned_team_id:
        assignment_changed = True
    
    if assignment_changed and task.status != TaskStatus.PENDING:
        task.status = TaskStatus.PENDING
        task.cannot_do_reason = None
        task.completed_by = None
    
    for key, value in update_dict.items():
        setattr(task, key, value)
    
    # Update multi-user pool if provided
    if assigned_user_ids is not None:
        # Clear existing assignments
        db.query(TaskAssignment).filter(TaskAssignment.task_id == task_id).delete()
        # Add new assignments
        for user_id in assigned_user_ids:
            assignment = TaskAssignment(task_id=task.id, user_id=user_id)
            db.add(assignment)
    
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


def can_modify_task(task: Task, user: User, db: Session) -> bool:
    """Check if user can modify this task."""
    if user.role == Role.ADMIN:
        return True
    if task.assigned_to == user.id:
        return True
    # Team assignment
    if task.assigned_team_id and user.team_id == task.assigned_team_id:
        return True
    # Multi-user pool assignment
    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task.id,
        TaskAssignment.user_id == user.id
    ).first()
    if assignment:
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
    
    if not can_modify_task(task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    task.status = TaskStatus.DONE
    task.completed_by = current_user.id  # Track who completed it
    
    # Audit log
    log_action(
        db=db,
        action="TASK_DONE",
        entity_type="task",
        entity_id=task.id,
        entity_name=task.title,
        user_id=current_user.id,
        details=f"Marked task as done"
    )
    
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
    
    if not can_modify_task(task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    task.status = TaskStatus.CANNOT_DO
    task.cannot_do_reason = data.reason
    task.completed_by = current_user.id  # Track who flagged it
    
    # Audit log
    log_action(
        db=db,
        action="TASK_CANNOT_DO",
        entity_type="task",
        entity_id=task.id,
        entity_name=task.title,
        user_id=current_user.id,
        details=f"Reason: {data.reason}"
    )
    
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


@router.patch("/tasks/{task_id}/undo", response_model=TaskOut)
async def undo_task_status(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Undo task completion - reset to PENDING status."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_modify_task(task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    
    previous_status = task.status.value
    task.status = TaskStatus.PENDING
    task.cannot_do_reason = None
    task.completed_by = None  # Clear completer
    
    # Audit log
    log_action(
        db=db,
        action="TASK_UNDO",
        entity_type="task",
        entity_id=task.id,
        entity_name=task.title,
        user_id=current_user.id,
        details=f"Reset from {previous_status} to PENDING"
    )
    
    db.commit()
    db.refresh(task)
    return task_to_out(task, db)


@router.post("/tasks/{task_id}/send-reminder", response_model=TaskOut)
async def send_task_reminder_now(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)  # Admin only
):
    """Send a reminder for a task immediately (admin only)."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    event = db.query(Event).filter(Event.id == task.event_id).first()
    event_name = event.name if event else "Unknown Event"
    
    # Collect discord IDs from all sources
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
    
    if not discord_ids:
        raise HTTPException(status_code=400, detail="No users with Discord IDs to notify")
    
    # Send reminder in background
    background_tasks.add_task(
        send_reminder,
        discord_ids,
        task.title,
        event_name,
        None  # Use default message
    )
    
    return task_to_out(task, db)
