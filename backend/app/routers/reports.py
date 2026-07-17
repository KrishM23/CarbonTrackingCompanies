"""PDF ESG / carbon progress report via ReportLab."""

from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.engine.analytics import compute_metrics, format_emissions_short
from app.engine.forecast import build_forecast
from app.engine.insights import build_insights
from app.models import Company, EmissionsRecord, User

router = APIRouter(prefix="/api/reports", tags=["reports"])

TEAL = colors.Color(0.12, 0.45, 0.40)
INK = colors.Color(0.12, 0.14, 0.16)
MUTED = colors.Color(0.40, 0.44, 0.48)


@router.get("/pdf")
def export_pdf(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    if len(series) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 years of data")

    metrics = compute_metrics(
        series, company.baseline_year, company.target_year, company.reduction_pct
    )
    forecast = build_forecast(
        series, company.baseline_year, company.target_year, company.reduction_pct
    )
    insights = build_insights(company, series, metrics, forecast)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleCustom",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=INK,
        spaceAfter=4,
    )
    subtitle = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=MUTED,
        spaceAfter=12,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=TEAL,
        spaceBefore=14,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=INK,
        leading=14,
        spaceAfter=6,
    )

    story = []
    story.append(Paragraph("CarbonTrack", title))
    story.append(
        Paragraph(
            f"Emissions progress report · {company.name}"
            + (f" · {company.industry}" if company.industry else ""),
            subtitle,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=10))

    goal_pct = int(company.reduction_pct * 100)
    story.append(Paragraph("Target", h2))
    story.append(
        Paragraph(
            f"Reduce Scope 1–3 emissions by <b>{goal_pct}%</b> from "
            f"<b>{company.baseline_year}</b> baseline by <b>{company.target_year}</b>.",
            body,
        )
    )

    if metrics:
        status = "On pace" if metrics["on_track"] else "Behind pace"
        story.append(Paragraph("At a glance", h2))
        story.append(
            Paragraph(
                f"Latest inventory ({metrics['latest']['year']}): "
                f"<b>{format_emissions_short(metrics['latest']['emissions'])} t CO₂e</b>. "
                f"Baseline: {format_emissions_short(metrics['baseline_emissions'])}. "
                f"Target: {format_emissions_short(metrics['target_emissions'])}. "
                f"Progress vs goal: {metrics['pct_of_goal']:.0f}%. Status: <b>{status}</b>.",
                body,
            )
        )

    if not forecast.get("error"):
        story.append(Paragraph("Forecast", h2))
        proj = forecast.get("projections", {}).get("end")
        gap = forecast.get("gap")
        track = "on track" if forecast.get("on_track") else "short of target"
        prob = forecast.get("attainment_prob")
        prob_txt = f" Estimated attainment probability: {prob * 100:.0f}%." if prob is not None else ""
        story.append(
            Paragraph(
                f"Ensemble projection for {company.target_year}: "
                f"<b>{format_emissions_short(proj)} t CO₂e</b> "
                f"({track}; gap {format_emissions_short(abs(gap or 0))}). "
                f"Primary model: {forecast.get('primary_model')}.{prob_txt}",
                body,
            )
        )
        if forecast.get("models"):
            model_lines = ", ".join(
                f"{m['name']} (LOOCV RMSE {m.get('loocv_rmse') or '—'})"
                for m in forecast["models"][:5]
            )
            story.append(Paragraph(f"Candidate models: {model_lines}.", body))

    if insights.get("headlines"):
        story.append(Paragraph("Executive highlights", h2))
        for h in insights["headlines"][:4]:
            story.append(Paragraph(f"• {h}", body))

    quality = insights.get("quality") or {}
    if quality:
        story.append(Paragraph("Data quality", h2))
        story.append(
            Paragraph(
                f"Score <b>{quality.get('score')}</b> ({quality.get('grade')}). "
                + " ".join(quality.get("tips") or [])[:280],
                body,
            )
        )

    roadmap = insights.get("roadmap") or {}
    if roadmap.get("actions"):
        story.append(Paragraph("Priority abatement actions", h2))
        story.append(Paragraph(roadmap.get("summary") or "", body))
        for a in roadmap["actions"][:4]:
            story.append(
                Paragraph(
                    f"<b>{a['title']}</b> (Scope {a['scope']}, {a['phase']}) — "
                    f"~{format_emissions_short(a['impact_t'])} t · {a['owner']}. {a['detail']}",
                    body,
                )
            )

    story.append(Paragraph("Inventory history", h2))
    table_data = [["Year", "Scope 1", "Scope 2", "Scope 3", "Total"]]
    for r in rows:
        table_data.append(
            [
                str(r.year),
                f"{r.scope1:,.0f}",
                f"{r.scope2:,.0f}",
                f"{r.scope3:,.0f}",
                f"{r.total:,.0f}",
            ]
        )
    table = Table(table_data, colWidths=[28 * mm, 32 * mm, 32 * mm, 32 * mm, 32 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.Color(0.94, 0.96, 0.95)]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.Color(0.8, 0.84, 0.82)),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Methodology note", h2))
    story.append(
        Paragraph(
            "Forecasts use a leave-one-out cross-validated ensemble of OLS, "
            "recency-weighted OLS, polynomial, log-linear, Holt, and ridge models "
            "with 95% prediction intervals. Scenario simulation (available in-app) "
            "applies coupled Scope 1–3 levers with electrification load shift and "
            "capital-turnover S-curves. Figures are company-reported; CarbonTrack "
            "does not independently verify inventory data.",
            body,
        )
    )
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "Generated by CarbonTrack · Confidential · For internal ESG use",
            subtitle,
        )
    )

    doc.build(story)
    buf.seek(0)
    filename = f"carbontrack-{company.name.lower().replace(' ', '-')}-report.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
