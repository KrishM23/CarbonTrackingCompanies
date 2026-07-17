from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Company, User
from app.schemas import CompanyOut, CompanyUpdate

router = APIRouter(prefix="/api/company", tags=["company"])


def _company_for(user: User, db: Session) -> Company:
    company = db.query(Company).filter(Company.user_id == user.id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("", response_model=CompanyOut)
def get_company(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _company_for(user, db)


@router.patch("", response_model=CompanyOut)
def update_company(
    body: CompanyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _company_for(user, db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company
