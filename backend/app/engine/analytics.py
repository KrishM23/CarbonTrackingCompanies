"""Analytics helpers — adapted from Revitalize for company targets."""

from __future__ import annotations


def commitment_target(baseline: float, reduction_pct: float) -> float:
    return round(baseline * (1 - reduction_pct))


def build_commitment_line(
    baseline_year: int,
    baseline_emissions: float,
    target_year: int,
    reduction_pct: float,
    years: list[int],
) -> list[float | None]:
    target = commitment_target(baseline_emissions, reduction_pct)
    out: list[float | None] = []
    for y in years:
        if y < baseline_year:
            out.append(None)
        elif y >= target_year:
            out.append(float(target))
        else:
            frac = (y - baseline_year) / (target_year - baseline_year)
            out.append(round(baseline_emissions - (baseline_emissions - target) * frac))
    return out


def required_annual_rate(
    current: float, current_year: int, target: float, target_year: int
) -> float | None:
    years = target_year - current_year
    if years <= 0 or current <= 0:
        return None
    # Compound annual reduction rate needed
    ratio = target / current
    if ratio <= 0:
        return -1.0
    return ratio ** (1 / years) - 1


def format_emissions_short(n: float | None) -> str:
    if n is None:
        return "—"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if n >= 1000:
        return f"{n / 1000:.0f}k"
    return f"{n:.0f}"


def compute_metrics(
    series: list[dict],
    baseline_year: int,
    target_year: int,
    reduction_pct: float,
) -> dict | None:
    if not series:
        return None
    sorted_pts = sorted(series, key=lambda p: p["year"])
    latest = sorted_pts[-1]
    baseline_pt = next((p for p in sorted_pts if p["year"] == baseline_year), None)
    baseline_emissions = (
        baseline_pt["emissions"] if baseline_pt else sorted_pts[0]["emissions"]
    )
    if not baseline_emissions:
        return None

    target_emissions = commitment_target(baseline_emissions, reduction_pct)
    reduction_from_baseline = baseline_emissions - latest["emissions"]
    pct_from_baseline = (reduction_from_baseline / baseline_emissions) * 100
    required = baseline_emissions - target_emissions
    pct_of_goal = (reduction_from_baseline / required) * 100 if required > 0 else 0

    # Linear pace line
    span = max(1, target_year - baseline_year)
    frac = (latest["year"] - baseline_year) / span
    frac = max(0, min(1, frac))
    pace_target = round(baseline_emissions - (baseline_emissions - target_emissions) * frac)
    gap_to_pace = latest["emissions"] - pace_target

    scope = {
        "scope1": latest.get("scope1", 0) or 0,
        "scope2": latest.get("scope2", 0) or 0,
        "scope3": latest.get("scope3", 0) or 0,
    }

    return {
        "latest": latest,
        "baseline_emissions": baseline_emissions,
        "target_emissions": target_emissions,
        "pct_from_baseline": round(pct_from_baseline, 1),
        "pct_of_goal": round(pct_of_goal, 1),
        "pace_target": pace_target,
        "gap_to_pace": gap_to_pace,
        "on_track": gap_to_pace <= 0,
        "scope": scope,
    }
