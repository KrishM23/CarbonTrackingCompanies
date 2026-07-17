"""Paid-tier decision support: intensity, peers, data quality, roadmap, compliance."""

from __future__ import annotations

# Illustrative mid-market peer intensities (t CO₂e / $M revenue) by industry cluster.
# Directionally grounded in public CDP / EPA sector ranges — not audited benchmarks.
PEER_INTENSITY = {
    "industrial": {"label": "Industrial / manufacturing", "t_per_m": 280, "keywords": ["industrial", "manufactur", "goods", "steel", "chemical"]},
    "food": {"label": "Food & beverage", "t_per_m": 190, "keywords": ["food", "beverage", "agricult"]},
    "retail": {"label": "Retail & consumer", "t_per_m": 85, "keywords": ["retail", "consumer", "apparel"]},
    "tech": {"label": "Technology & software", "t_per_m": 35, "keywords": ["tech", "software", "saas", "it ", "digital"]},
    "logistics": {"label": "Logistics & transport", "t_per_m": 320, "keywords": ["logistic", "transport", "shipping", "fleet"]},
    "professional": {"label": "Professional services", "t_per_m": 28, "keywords": ["consult", "professional", "service", "legal", "account"]},
    "healthcare": {"label": "Healthcare", "t_per_m": 120, "keywords": ["health", "pharma", "medical", "biotech"]},
    "default": {"label": "General mid-market", "t_per_m": 110, "keywords": []},
}


def _match_peer(industry: str) -> dict:
    ind = (industry or "").lower()
    for key, meta in PEER_INTENSITY.items():
        if key == "default":
            continue
        if any(k in ind for k in meta["keywords"]):
            return meta
    return PEER_INTENSITY["default"]


def data_quality(series: list[dict]) -> dict:
    if not series:
        return {
            "score": 0,
            "grade": "Incomplete",
            "checks": [
                {"id": "years", "ok": False, "label": "At least 2 inventory years"},
                {"id": "scopes", "ok": False, "label": "Scope 1–3 split present"},
                {"id": "recent", "ok": False, "label": "Data within last 2 calendar years"},
                {"id": "continuity", "ok": False, "label": "No large unexplained gaps"},
            ],
            "tips": ["Import or enter at least two years of Scope 1–3 totals to unlock forecasting."],
        }

    years = sorted(p["year"] for p in series)
    latest = max(series, key=lambda p: p["year"])
    has_scopes = all(
        (p.get("scope1") or 0) + (p.get("scope2") or 0) + (p.get("scope3") or 0) > 0
        for p in series[-3:]
    )
    from datetime import datetime

    recent = latest["year"] >= datetime.utcnow().year - 2
    # Continuity: gaps of >2 years between consecutive points
    gaps = [years[i + 1] - years[i] for i in range(len(years) - 1)]
    continuity = len(years) >= 2 and (not gaps or max(gaps) <= 2)
    multi = len(series) >= 2

    checks = [
        {"id": "years", "ok": multi, "label": "At least 2 inventory years"},
        {"id": "scopes", "ok": has_scopes, "label": "Scope 1–3 split present"},
        {"id": "recent", "ok": recent, "label": "Recent inventory year"},
        {"id": "continuity", "ok": continuity, "label": "Continuous time series"},
    ]
    score = round(100 * sum(1 for c in checks if c["ok"]) / len(checks))
    grade = (
        "Audit-ready" if score >= 90
        else "Strong" if score >= 75
        else "Developing" if score >= 50
        else "Incomplete"
    )
    tips = []
    if not multi:
        tips.append("Add a second inventory year to enable ensemble forecasting.")
    if not has_scopes:
        tips.append("Break totals into Scope 1, 2, and 3 for credible scenario modeling.")
    if not recent:
        tips.append("Update to the latest reporting year for board-ready dashboards.")
    if not continuity:
        tips.append("Fill missing years so trend and LOOCV models stay stable.")
    if not tips:
        tips.append("Inventory looks solid. Next: save a board scenario and export the PDF briefing.")

    return {"score": score, "grade": grade, "checks": checks, "tips": tips}


def intensity_metrics(
    latest_total: float,
    employees: int,
    revenue_m: float,
    industry: str,
) -> dict:
    per_employee = round(latest_total / employees, 1) if employees > 0 else None
    per_revenue = round(latest_total / revenue_m, 1) if revenue_m > 0 else None
    peer = _match_peer(industry)
    vs_peer = None
    if per_revenue is not None and peer["t_per_m"] > 0:
        vs_peer = round(((per_revenue - peer["t_per_m"]) / peer["t_per_m"]) * 100, 1)

    return {
        "per_employee": per_employee,
        "per_revenue_m": per_revenue,
        "peer_label": peer["label"],
        "peer_t_per_m": peer["t_per_m"],
        "vs_peer_pct": vs_peer,
        "better_than_peer": vs_peer is not None and vs_peer < 0,
    }


def build_roadmap(
    scope: dict,
    metrics: dict | None,
    forecast: dict,
    company_name: str,
) -> dict:
    """Phased abatement actions ranked by estimated inventory leverage."""
    s1 = scope.get("scope1") or 0
    s2 = scope.get("scope2") or 0
    s3 = scope.get("scope3") or 0
    total = max(s1 + s2 + s3, 1)
    target_year = forecast.get("target_year") or 2035
    gap = forecast.get("gap") or 0

    actions = [
        {
            "id": "electrify",
            "scope": 1,
            "title": "Electrify process heat & fleet",
            "phase": "Near-term",
            "years": "0–3 years",
            "priority": "high" if s1 / total > 0.35 else "medium",
            "impact_t": round(s1 * 0.35),
            "impact_pct": round(35 * s1 / total, 1),
            "cost_band": "Capex-heavy",
            "owner": "Facilities / Ops",
            "detail": "Replace gas boilers and yard equipment; pair with a renewable PPA so load shift does not rebound.",
        },
        {
            "id": "clean-power",
            "scope": 2,
            "title": "Lock in cleaner electricity",
            "phase": "Near-term",
            "years": "0–2 years",
            "priority": "high" if s2 / total > 0.2 else "medium",
            "impact_t": round(s2 * 0.55),
            "impact_pct": round(55 * s2 / total, 1),
            "cost_band": "Opex / contract",
            "owner": "Procurement / Finance",
            "detail": "Pursue on-site solar, VPPA, or utility green tariff. Highest ROI when electrification is also planned.",
        },
        {
            "id": "travel",
            "scope": 3,
            "title": "Cut travel & commute emissions",
            "phase": "Near-term",
            "years": "0–2 years",
            "priority": "high" if s3 / total > 0.35 else "medium",
            "impact_t": round(s3 * 0.25),
            "impact_pct": round(25 * s3 / total, 1),
            "cost_band": "Low / policy",
            "owner": "People / Travel",
            "detail": "Hybrid work policy, rail-first travel rules, and EV commute incentives.",
        },
        {
            "id": "suppliers",
            "scope": 3,
            "title": "Engage top suppliers on Scope 3",
            "phase": "Mid-term",
            "years": "2–5 years",
            "priority": "high" if s3 / total > 0.4 else "medium",
            "impact_t": round(s3 * 0.2),
            "impact_pct": round(20 * s3 / total, 1),
            "cost_band": "Program cost",
            "owner": "Supply chain",
            "detail": "Request primary data from top 20 suppliers by spend; set contractual reduction clauses.",
        },
        {
            "id": "efficiency",
            "scope": 1,
            "title": "Building & process efficiency",
            "phase": "Near-term",
            "years": "0–3 years",
            "priority": "medium",
            "impact_t": round((s1 + s2) * 0.08),
            "impact_pct": round(8 * (s1 + s2) / total, 1),
            "cost_band": "Quick wins",
            "owner": "Facilities",
            "detail": "Controls, insulation, compressed air leaks, and LED/HVAC upgrades with <3 year payback.",
        },
        {
            "id": "product",
            "scope": 3,
            "title": "Product & packaging redesign",
            "phase": "Long-term",
            "years": "3–8 years",
            "priority": "medium",
            "impact_t": round(s3 * 0.15),
            "impact_pct": round(15 * s3 / total, 1),
            "cost_band": "Strategic",
            "owner": "Product / R&D",
            "detail": "Material substitution and circular design for downstream use-phase and end-of-life.",
        },
    ]

    actions.sort(key=lambda a: (-(1 if a["priority"] == "high" else 0), -a["impact_t"]))

    phases = {
        "Near-term": [a for a in actions if a["phase"] == "Near-term"],
        "Mid-term": [a for a in actions if a["phase"] == "Mid-term"],
        "Long-term": [a for a in actions if a["phase"] == "Long-term"],
    }

    near_impact = sum(a["impact_t"] for a in phases["Near-term"])
    closes_gap = gap > 0 and near_impact >= gap * 0.6

    return {
        "company": company_name,
        "actions": actions,
        "phases": phases,
        "summary": (
            f"Prioritized abatement for {company_name}. Near-term actions could abate roughly "
            f"{near_impact:,.0f} t CO₂e — "
            + (
                "enough to close most of the forecast gap if implemented with cleaner power."
                if closes_gap
                else f"helpful progress toward the {target_year} target; pair with deeper Scope 3 work."
            )
        ),
        "near_term_impact_t": near_impact,
        "closes_most_of_gap": closes_gap,
    }


def compliance_checklist(
    metrics: dict | None,
    forecast: dict,
    quality: dict,
    has_scopes: bool,
    framework: str,
) -> list[dict]:
    on_track = bool(forecast.get("on_track"))
    items = [
        {
            "id": "boundary",
            "label": "Organizational boundary documented (equity / control)",
            "status": "ready" if has_scopes else "todo",
            "framework": "GHG Protocol",
        },
        {
            "id": "scopes",
            "label": "Scope 1, 2, and material Scope 3 categories inventoried",
            "status": "ready" if has_scopes else "todo",
            "framework": "GHG Protocol",
        },
        {
            "id": "baseline",
            "label": "Baseline year locked with restatement policy",
            "status": "ready" if metrics else "todo",
            "framework": framework or "GHG Protocol",
        },
        {
            "id": "target",
            "label": "Science-aligned absolute reduction target set",
            "status": "ready" if metrics else "todo",
            "framework": "SBTi-ready",
        },
        {
            "id": "trajectory",
            "label": "Trajectory modeled vs. target with uncertainty",
            "status": "ready" if not forecast.get("error") else "todo",
            "framework": "Internal assurance",
        },
        {
            "id": "quality",
            "label": "Data quality score ≥ 75 (Strong)",
            "status": "ready" if quality.get("score", 0) >= 75 else "todo",
            "framework": "Disclosure readiness",
        },
        {
            "id": "pathway",
            "label": "Credible abatement pathway identified",
            "status": "ready" if on_track or not forecast.get("error") else "todo",
            "framework": "Board reporting",
        },
    ]
    done = sum(1 for i in items if i["status"] == "ready")
    return {"items": items, "ready_count": done, "total": len(items), "pct": round(100 * done / len(items))}


def yoy_trend(series: list[dict]) -> dict | None:
    if len(series) < 2:
        return None
    sorted_pts = sorted(series, key=lambda p: p["year"])
    a, b = sorted_pts[-2], sorted_pts[-1]
    delta = b["emissions"] - a["emissions"]
    pct = (delta / a["emissions"] * 100) if a["emissions"] else 0
    return {
        "from_year": a["year"],
        "to_year": b["year"],
        "delta_t": round(delta),
        "delta_pct": round(pct, 1),
        "improved": delta < 0,
    }


def build_insights(
    company,
    series: list[dict],
    metrics: dict | None,
    forecast: dict,
) -> dict:
    scope = (
        metrics["scope"]
        if metrics
        else {"scope1": 0, "scope2": 0, "scope3": 0}
    )
    latest_total = metrics["latest"]["emissions"] if metrics else 0
    quality = data_quality(series)
    intensity = intensity_metrics(
        latest_total,
        getattr(company, "employee_count", 0) or 0,
        getattr(company, "annual_revenue_m", 0) or 0,
        company.industry or "",
    )
    roadmap = build_roadmap(scope, metrics, forecast, company.name)
    compliance = compliance_checklist(
        metrics,
        forecast,
        quality,
        bool(series and (scope["scope1"] + scope["scope2"] + scope["scope3"]) > 0),
        getattr(company, "framework", None) or "GHG Protocol",
    )
    trend = yoy_trend(series)

    headlines = []
    if metrics:
        if metrics["on_track"]:
            headlines.append(
                f"On pace vs. the linear path to your {company.target_year} target."
            )
        else:
            headlines.append(
                f"Behind the linear pace path — gap of {abs(metrics['gap_to_pace']):,.0f} t CO₂e this year."
            )
    if not forecast.get("error") and forecast.get("attainment_prob") is not None:
        headlines.append(
            f"Ensemble attainment probability ~{round(forecast['attainment_prob'] * 100)}% by {company.target_year}."
        )
    if intensity.get("vs_peer_pct") is not None:
        if intensity["better_than_peer"]:
            headlines.append(
                f"Carbon intensity is {abs(intensity['vs_peer_pct'])}% better than the {intensity['peer_label']} peer band."
            )
        else:
            headlines.append(
                f"Carbon intensity is {intensity['vs_peer_pct']}% above the {intensity['peer_label']} peer band."
            )
    if trend:
        direction = "down" if trend["improved"] else "up"
        headlines.append(
            f"Year-over-year emissions {direction} {abs(trend['delta_pct'])}% ({trend['from_year']}→{trend['to_year']})."
        )

    return {
        "headlines": headlines,
        "quality": quality,
        "intensity": intensity,
        "roadmap": roadmap,
        "compliance": compliance,
        "yoy": trend,
    }
