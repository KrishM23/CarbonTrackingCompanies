from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.engine.analytics import compute_metrics
from app.engine.forecast import build_forecast
from app.engine.insights import build_insights
from app.engine.scenarios import LEVER_DEFS, SCENARIO_PRESETS, run_scenario
from app.models import Company, EmissionsRecord, SavedScenario, User
from app.schemas import LeversIn, SaveScenarioIn, SavedScenarioOut

router = APIRouter(prefix="/api", tags=["analytics"])


def _company_payload(company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "industry": company.industry,
        "baseline_year": company.baseline_year,
        "target_year": company.target_year,
        "reduction_pct": company.reduction_pct,
        "employee_count": getattr(company, "employee_count", 0) or 0,
        "annual_revenue_m": getattr(company, "annual_revenue_m", 0) or 0,
        "framework": getattr(company, "framework", None) or "GHG Protocol",
        "hq_country": getattr(company, "hq_country", None) or "United States",
    }


def _load_context(user: User, db: Session):
    company = db.query(Company).filter(Company.user_id == user.id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    rows = (
        db.query(EmissionsRecord)
        .filter(EmissionsRecord.company_id == company.id)
        .order_by(EmissionsRecord.year)
        .all()
    )
    series = [
        {
            "year": r.year,
            "emissions": r.total,
            "scope1": r.scope1,
            "scope2": r.scope2,
            "scope3": r.scope3,
        }
        for r in rows
    ]
    return company, series


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company, series = _load_context(user, db)
    metrics = compute_metrics(
        series,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )
    forecast = (
        build_forecast(
            series,
            company.baseline_year,
            company.target_year,
            company.reduction_pct,
        )
        if len(series) >= 2
        else {"error": "Need at least 2 years of emissions data", "points": len(series)}
    )
    insights = build_insights(company, series, metrics, forecast)
    return {
        "company": _company_payload(company),
        "series": series,
        "metrics": metrics,
        "forecast": forecast,
        "insights": insights,
    }


@router.get("/insights")
def insights(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company, series = _load_context(user, db)
    metrics = compute_metrics(
        series, company.baseline_year, company.target_year, company.reduction_pct
    )
    forecast = (
        build_forecast(
            series, company.baseline_year, company.target_year, company.reduction_pct
        )
        if len(series) >= 2
        else {"error": "Need at least 2 years of emissions data", "points": len(series)}
    )
    return build_insights(company, series, metrics, forecast)


@router.get("/forecast")
def forecast(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company, series = _load_context(user, db)
    if len(series) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 years of data")
    return build_forecast(
        series,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )


@router.get("/scenarios/meta")
def scenario_meta():
    return {"lever_defs": LEVER_DEFS, "presets": SCENARIO_PRESETS}


@router.post("/scenarios/run")
def scenarios_run(
    body: LeversIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company, series = _load_context(user, db)
    if len(series) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 years of data")

    metrics = compute_metrics(
        series,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )
    forecast = build_forecast(
        series,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )
    if forecast.get("error"):
        raise HTTPException(status_code=400, detail=forecast["error"])

    scope = metrics["scope"] if metrics else {"scope1": 0, "scope2": 0, "scope3": 0}
    levers = body.model_dump()
    result = run_scenario(
        forecast,
        scope,
        metrics,
        levers,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )
    return result


@router.get("/scenarios/saved", response_model=list[SavedScenarioOut])
def list_saved(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company, _ = _load_context(user, db)
    return (
        db.query(SavedScenario)
        .filter(SavedScenario.company_id == company.id)
        .order_by(SavedScenario.created_at.desc())
        .all()
    )


@router.post("/scenarios/saved", response_model=SavedScenarioOut)
def save_scenario(
    body: SaveScenarioIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company, series = _load_context(user, db)
    if len(series) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 years of data")

    metrics = compute_metrics(
        series, company.baseline_year, company.target_year, company.reduction_pct
    )
    forecast = build_forecast(
        series, company.baseline_year, company.target_year, company.reduction_pct
    )
    if forecast.get("error"):
        raise HTTPException(status_code=400, detail=forecast["error"])

    levers = {
        "scope1_cut": body.scope1_cut,
        "scope2_cut": body.scope2_cut,
        "scope3_cut": body.scope3_cut,
        "ramp_years": body.ramp_years,
    }
    result = run_scenario(
        forecast,
        metrics["scope"] if metrics else {"scope1": 0, "scope2": 0, "scope3": 0},
        metrics,
        levers,
        company.baseline_year,
        company.target_year,
        company.reduction_pct,
    )
    row = SavedScenario(
        company_id=company.id,
        name=body.name.strip(),
        notes=body.notes or "",
        scope1_cut=body.scope1_cut,
        scope2_cut=body.scope2_cut,
        scope3_cut=body.scope3_cut,
        ramp_years=body.ramp_years,
        scenario_end=result["scenario_end"] if result else 0,
        improvement=result["improvement"] if result else 0,
        on_track=bool(result and result["on_track_scenario"]),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/scenarios/saved/{scenario_id}")
def delete_saved(
    scenario_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company, _ = _load_context(user, db)
    row = (
        db.query(SavedScenario)
        .filter(SavedScenario.id == scenario_id, SavedScenario.company_id == company.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
