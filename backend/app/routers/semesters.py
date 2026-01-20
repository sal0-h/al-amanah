from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Semester, User
from app.schemas import SemesterCreate, SemesterUpdate, SemesterOut
from app.middleware.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/semesters", tags=["semesters"])


@router.get("", response_model=List[SemesterOut])
async def list_semesters(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    return db.query(Semester).order_by(Semester.start_date.desc()).all()


@router.post("", response_model=SemesterOut)
async def create_semester(
    semester_data: SemesterCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    # If this semester is active, deactivate all others
    if semester_data.is_active:
        db.query(Semester).filter(Semester.is_active == True).update({"is_active": False})
    
    semester = Semester(**semester_data.model_dump())
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return semester


@router.put("/{semester_id}", response_model=SemesterOut)
async def update_semester(
    semester_id: int,
    semester_data: SemesterUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    update_dict = semester_data.model_dump(exclude_unset=True)
    
    # If setting this semester to active, deactivate all others first
    if update_dict.get("is_active") == True:
        db.query(Semester).filter(
            Semester.is_active == True, 
            Semester.id != semester_id
        ).update({"is_active": False})
    
    for key, value in update_dict.items():
        setattr(semester, key, value)
    
    db.commit()
    db.refresh(semester)
    return semester


@router.delete("/{semester_id}")
async def delete_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    db.delete(semester)
    db.commit()
    return {"message": "Semester deleted"}
