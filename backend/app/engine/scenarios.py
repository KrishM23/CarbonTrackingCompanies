"""Coupled what-if scenario engine — ported from Revitalize scenarios.js v2.1.

Levers: electrification (S1), cleaner electricity (S2), travel reduction (S3),
with load-shift rebound, logistic capital ramp, diminishing returns, synergy.
"""

from __future__ import annotations

import math

from app.engine.analytics import build_commitment_line, required_annual_rate

SCENARIO_MODEL = {
    "version": "2.1",
    "load_shift_factor": 0.35,
    "diminishing_beta": 0.12,
    "ramp_k": 6,
    "synergy_max": 0.04,
}

SCOPE_LABELS = {
    1: "Direct (fuel & fleet)",
    2: "Purchased electricity",
    3: "Travel & value chain",
}

LEVER_DEFS = [
    {
        "id": "scope1_cut",
        "scope": 1,
        "label": "Electrify on-site fuel",
        "sub": "Gas heating, boilers, fleet. Shifts load to electricity unless paired with cleaner power",
        "min": 0,
        "max": 85,
        "step": 5,
        "default": 0,
    },
    {
        "id": "scope2_cut",
        "scope": 2,
        "label": "Buy cleaner electricity",
        "sub": "Solar PPAs, renewables, green tariffs. Also abates rebound from electrification",
        "min": 0,
        "max": 90,
        "step": 5,
        "default": 0,
    },
    {
        "id": "scope3_cut",
        "scope": 3,
        "label": "Cut travel & commuting",
        "sub": "Remote work, transit, procurement, business travel",
        "min": 0,
        "max": 60,
        "step": 5,
        "default": 0,
    },
    {
        "id": "ramp_years",
        "scope": None,
        "label": "Years to fully implement",
        "sub": "Capital turnover delay. Cuts ramp on an S-curve",
        "min": 5,
        "max": 20,
        "step": 1,
        "default": 12,
        "unit": "yr",
    },
]

SCENARIO_PRESETS = [
    {
        "id": "status-quo",
        "label": "Current trend",
        "desc": "No new interventions beyond the forecast.",
        "levers": {"scope1_cut": 0, "scope2_cut": 0, "scope3_cut": 0, "ramp_years": 12},
    },
    {
        "id": "moderate",
        "label": "Moderate progress",
        "desc": "Steady electrification and cleaner power.",
        "levers": {"scope1_cut": 30, "scope2_cut": 45, "scope3_cut": 15, "ramp_years": 15},
    },
    {
        "id": "electrify",
        "label": "Electrification push",
        "desc": "Prioritize fuel switching with cleaner electricity.",
        "levers": {"scope1_cut": 65, "scope2_cut": 55, "scope3_cut": 10, "ramp_years": 12},
    },
    {
        "id": "travel",
        "label": "Travel & commute focus",
        "desc": "Best when Scope 3 is a large share.",
        "levers": {"scope1_cut": 20, "scope2_cut": 25, "scope3_cut": 45, "ramp_years": 10},
    },
    {
        "id": "ambitious",
        "label": "Ambitious path",
        "desc": "Aggressive cuts across all scopes on a faster timeline.",
        "levers": {"scope1_cut": 75, "scope2_cut": 80, "scope3_cut": 35, "ramp_years": 10},
    },
]


def effective_cut(fraction: float, beta: float = SCENARIO_MODEL["diminishing_beta"]) -> float:
    c = max(0.0, min(1.0, fraction))
    return c * (1 - beta * c)


def capital_ramp(
    year: int, start_year: int, ramp_years: int, k: float = SCENARIO_MODEL["ramp_k"]
) -> float:
    if year < start_year:
        return 0.0
    span = max(1, ramp_years)
    u = min(1.0, (year - start_year + 1) / span)

    def logistic(x: float) -> float:
        return 1 / (1 + math.exp(-k * (2 * x - 1)))

    lo, hi = logistic(0), logistic(1)
    return (logistic(u) - lo) / (hi - lo)


def coupled_savings(
    scope_data: dict, levers: dict, model: dict | None = None
) -> dict:
    model = model or SCENARIO_MODEL
    s1 = max(0.0, scope_data.get("scope1") or 0)
    s2 = max(0.0, scope_data.get("scope2") or 0)
    s3 = max(0.0, scope_data.get("scope3") or 0)

    eff1 = effective_cut((levers.get("scope1_cut") or 0) / 100, model["diminishing_beta"])
    eff2 = effective_cut((levers.get("scope2_cut") or 0) / 100, model["diminishing_beta"])
    eff3 = effective_cut((levers.get("scope3_cut") or 0) / 100, model["diminishing_beta"])

    scope1_save = s1 * eff1
    load_shift_gross = scope1_save * model["load_shift_factor"]
    load_shift_residual = load_shift_gross * (1 - eff2)
    scope2_save = s2 * eff2
    scope3_save = s3 * eff3

    synergy = model["synergy_max"] * min(eff1, eff2) * (s1 + s2)
    independent = scope1_save + scope2_save + scope3_save
    gross_net = independent - load_shift_residual + synergy
    total = s1 + s2 + s3
    net_full = max(0.0, min(gross_net, total))

    scope_savings = [
        {"scope": 1, "label": SCOPE_LABELS[1], "amount": scope1_save},
        {
            "scope": 2,
            "label": SCOPE_LABELS[2],
            "amount": max(0, scope2_save - load_shift_residual + synergy * 0.5),
        },
        {"scope": 3, "label": SCOPE_LABELS[3], "amount": scope3_save},
    ]
    scope_savings = [
        {**s, "share": (s["amount"] / net_full) * 100 if net_full else 0}
        for s in scope_savings
        if s["amount"] > 0
    ]

    return {
        "net_full": net_full,
        "scope1_save": scope1_save,
        "scope2_save": scope2_save,
        "scope3_save": scope3_save,
        "load_shift_gross": load_shift_gross,
        "load_shift_residual": load_shift_residual,
        "synergy": synergy,
        "independent_sum": independent,
        "scope_savings": scope_savings,
        "total_scopes": total,
        "effective_cuts": {"scope1": eff1, "scope2": eff2, "scope3": eff3},
    }


def structural_savings_bounds(scope_data: dict, levers: dict) -> dict:
    optimistic = coupled_savings(
        scope_data,
        levers,
        {**SCENARIO_MODEL, "load_shift_factor": 0.25, "synergy_max": SCENARIO_MODEL["synergy_max"]},
    )
    pessimistic = coupled_savings(
        scope_data,
        levers,
        {**SCENARIO_MODEL, "load_shift_factor": 0.45, "synergy_max": 0},
    )
    return {"high": optimistic["net_full"], "low": pessimistic["net_full"]}


def _apply_path(
    baseline: list[float],
    years: list[int],
    start_year: int,
    ramp_years: int,
    savings: float,
) -> list[int]:
    return [
        round(max(0, baseline[i] - savings * capital_ramp(y, start_year, ramp_years)))
        for i, y in enumerate(years)
    ]


def run_scenario(
    forecast: dict,
    scope_data: dict,
    metrics: dict,
    levers: dict,
    baseline_year: int,
    target_year: int,
    reduction_pct: float,
) -> dict | None:
    if not forecast or forecast.get("error") or not metrics:
        return None

    latest_year = metrics["latest"]["year"]
    start_year = latest_year + 1
    ramp_years = int(levers.get("ramp_years") or 12)

    coupled = coupled_savings(scope_data, levers)
    bounds = structural_savings_bounds(scope_data, levers)
    full_savings = coupled["net_full"]

    years = forecast.get("forecast_years") or []
    baseline = forecast.get("median") or []
    scenario = _apply_path(baseline, years, start_year, ramp_years, full_savings)
    scenario_low = _apply_path(baseline, years, start_year, ramp_years, bounds["low"])
    scenario_high = _apply_path(baseline, years, start_year, ramp_years, bounds["high"])

    baseline_end = forecast.get("projections", {}).get("end") or (
        baseline[-1] if baseline else 0
    )
    scenario_end = scenario[-1] if scenario else baseline_end
    target = metrics["target_emissions"]
    baseline_emissions = metrics["baseline_emissions"]

    improvement = baseline_end - scenario_end
    gap_baseline = baseline_end - target
    gap_scenario = scenario_end - target

    commitment = build_commitment_line(
        baseline_year, baseline_emissions, target_year, reduction_pct, years
    )

    return {
        "years": years,
        "baseline": baseline,
        "scenario": scenario,
        "scenario_low": scenario_low,
        "scenario_high": scenario_high,
        "commitment": commitment,
        "full_savings": round(full_savings),
        "savings_low": round(bounds["low"]),
        "savings_high": round(bounds["high"]),
        "scope_savings": [
            {**s, "amount": round(s["amount"])} for s in coupled["scope_savings"]
        ],
        "coupling": {
            "load_shift_gross": round(coupled["load_shift_gross"]),
            "load_shift_residual": round(coupled["load_shift_residual"]),
            "synergy": round(coupled["synergy"]),
            "independent_sum": round(coupled["independent_sum"]),
            "model_version": SCENARIO_MODEL["version"],
        },
        "baseline_end": baseline_end,
        "scenario_end": scenario_end,
        "target": target,
        "target_year": target_year,
        "improvement": improvement,
        "gap_baseline": gap_baseline,
        "gap_scenario": gap_scenario,
        "baseline_cut_pct": (
            ((baseline_emissions - baseline_end) / baseline_emissions) * 100
            if baseline_emissions
            else 0
        ),
        "scenario_cut_pct": (
            ((baseline_emissions - scenario_end) / baseline_emissions) * 100
            if baseline_emissions
            else 0
        ),
        "goal_cut_pct": reduction_pct * 100,
        "on_track_baseline": gap_baseline <= 0,
        "on_track_scenario": gap_scenario <= 0,
        "required_from_now": required_annual_rate(
            metrics["latest"]["emissions"], latest_year, target, target_year
        ),
        "ramp_years": ramp_years,
        "start_year": start_year,
        "levers": levers,
        "presets": SCENARIO_PRESETS,
        "lever_defs": LEVER_DEFS,
    }
