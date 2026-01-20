from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Week, Semester, User
from app.schemas import WeekCreate, WeekUpdate, WeekOut
from app.middleware.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api", tags=["weeks"])


@router.get("/semesters/{semester_id}/weeks", response_model=List[WeekOut])
async def list_weeks(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    return db.query(Week).filter(Week.semester_id == semester_id).order_by(Week.week_number).all()


@router.post("/semesters/{semester_id}/weeks", response_model=WeekOut)
async def create_week(
    semester_id: int,
    week_data: WeekCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    week = Week(semester_id=semester_id, **week_data.model_dump())
    db.add(week)
    db.commit()
    db.refresh(week)
    return week


@router.put("/weeks/{week_id}", response_model=WeekOut)
async def update_week(
    week_id: int,
    week_data: WeekUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    
    for key, value in week_data.model_dump(exclude_unset=True).items():
        setattr(week, key, value)
    
    db.commit()
    db.refresh(week)
    return week


@router.delete("/weeks/{week_id}")
async def delete_week(
    week_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    
    db.delete(week)
    db.commit()
    return {"message": "Week deleted"}
