import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Company, EmissionsRecord, User
from app.schemas import EmissionsBulkIn, EmissionsIn, EmissionsOut

router = APIRouter(prefix="/api/emissions", tags=["emissions"])


def _company(user: User, db: Session) -> Company:
    company = db.query(Company).filter(Company.user_id == user.id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _total(s1: float, s2: float, s3: float) -> float:
    return round(float(s1 or 0) + float(s2 or 0) + float(s3 or 0), 2)


def _upsert(db: Session, company_id: int, body: EmissionsIn) -> EmissionsRecord:
    existing = (
        db.query(EmissionsRecord)
        .filter(
            EmissionsRecord.company_id == company_id,
            EmissionsRecord.year == body.year,
        )
        .first()
    )
    total = _total(body.scope1, body.scope2, body.scope3)
    if existing:
        existing.scope1 = body.scope1
        existing.scope2 = body.scope2
        existing.scope3 = body.scope3
        existing.total = total
        existing.notes = body.notes
        existing.verified = body.verified
        return existing

    rec = EmissionsRecord(
        company_id=company_id,
        year=body.year,
        scope1=body.scope1,
        scope2=body.scope2,
        scope3=body.scope3,
        total=total,
        notes=body.notes,
        verified=body.verified,
    )
    db.add(rec)
    return rec


@router.get("", response_model=list[EmissionsOut])
def list_emissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _company(user, db)
    rows = (
        db.query(EmissionsRecord)
        .filter(EmissionsRecord.company_id == company.id)
        .order_by(EmissionsRecord.year)
        .all()
    )
    return rows


@router.post("", response_model=EmissionsOut)
def upsert_emissions(
    body: EmissionsIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _company(user, db)
    rec = _upsert(db, company.id, body)
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/bulk", response_model=list[EmissionsOut])
def bulk_upsert(
    body: EmissionsBulkIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _company(user, db)
    results = [_upsert(db, company.id, r) for r in body.records]
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.post("/csv", response_model=list[EmissionsOut])
async def import_csv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """CSV columns: year,scope1,scope2,scope3[,notes]"""
    company = _company(user, db)
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Empty CSV")

    # Normalize headers
    field_map = {h.strip().lower().replace(" ", ""): h for h in reader.fieldnames}
    required = ["year"]
    for r in required:
        if r not in field_map:
            raise HTTPException(
                status_code=400,
                detail="CSV must include year, and ideally scope1,scope2,scope3",
            )

    results = []
    for row in reader:
        def get(key: str, default: str = "0") -> str:
            src = field_map.get(key)
            if not src:
                return default
            val = (row.get(src) or "").strip()
            return val if val else default

        try:
            year = int(float(get("year")))
            s1 = float(get("scope1", "0"))
            s2 = float(get("scope2", "0"))
            s3 = float(get("scope3", "0"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid row: {row}")

        notes_key = field_map.get("notes")
        notes = (row.get(notes_key) or "").strip() if notes_key else ""
        body = EmissionsIn(year=year, scope1=s1, scope2=s2, scope3=s3, notes=notes)
        results.append(_upsert(db, company.id, body))

    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.delete("/{year}")
def delete_year(
    year: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _company(user, db)
    rec = (
        db.query(EmissionsRecord)
        .filter(EmissionsRecord.company_id == company.id, EmissionsRecord.year == year)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(rec)
    db.commit()
    return {"ok": True}
