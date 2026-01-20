from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import Task, User, TaskComment, Role, TaskAssignment
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["comments"])


class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    user_name: str
    content: str
    created_at: datetime
    can_delete: bool = False
    
    class Config:
        from_attributes = True


def can_view_task(task: Task, user: User, db: Session) -> bool:
    """Check if user can view this task (and its comments)."""
    if user.role == Role.ADMIN:
        return True
    if task.assigned_to == user.id:
        return True
    if task.assigned_team_id and user.team_id == task.assigned_team_id:
        return True
    # Check multi-user pool
    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task.id,
        TaskAssignment.user_id == user.id
    ).first()
    return assignment is not None


@router.get("/{task_id}/comments", response_model=List[CommentOut])
async def get_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all comments for a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_view_task(task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to view this task")
    
    comments = db.query(TaskComment).filter(
        TaskComment.task_id == task_id
    ).order_by(TaskComment.created_at.asc()).all()
    
    return [
        CommentOut(
            id=c.id,
            task_id=c.task_id,
            user_id=c.user_id,
            user_name=c.user.display_name if c.user else "Unknown",
            content=c.content,
            created_at=c.created_at,
            can_delete=(c.user_id == current_user.id or current_user.role == Role.ADMIN)
        )
        for c in comments
    ]


@router.post("/{task_id}/comments", response_model=CommentOut)
async def add_comment(
    task_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a comment to a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not can_view_task(task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to comment on this task")
    
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    
    comment = TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        content=data.content.strip()
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return CommentOut(
        id=comment.id,
        task_id=comment.task_id,
        user_id=comment.user_id,
        user_name=current_user.display_name,
        content=comment.content,
        created_at=comment.created_at,
        can_delete=True
    )


@router.delete("/{task_id}/comments/{comment_id}")
async def delete_comment(
    task_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a comment. Users can delete their own comments, admins can delete any."""
    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check permission
    if comment.user_id != current_user.id and current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}
