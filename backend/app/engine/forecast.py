"""5-model ensemble forecasting with LOOCV-weighted prediction intervals.

Ported from Revitalize (Carbon Trackers) forecast.js — company-scoped.
Models: OLS linear, recency-weighted OLS, polynomial, log-linear, Holt,
damped Holt, ridge polynomial. Selection via leave-one-out CV.
"""

from __future__ import annotations

import math
from typing import Callable

from app.engine.analytics import commitment_target

MIN_POINTS = 3
CONFIDENCE_Z = 1.96


def _mean(arr: list[float]) -> float:
    return sum(arr) / len(arr) if arr else 0.0


def _rmse(residuals: list[float]) -> float:
    return math.sqrt(_mean([r * r for r in residuals]))


def _r2(ys: list[float], yhats: list[float]) -> float:
    ybar = _mean(ys)
    ss_tot = sum((y - ybar) ** 2 for y in ys)
    if ss_tot == 0:
        return 1.0
    ss_res = sum((y - yh) ** 2 for y, yh in zip(ys, yhats))
    return max(-math.inf, min(1.0, 1 - ss_res / ss_tot))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _predict_interval(yhat: float, se: float, z: float = CONFIDENCE_Z) -> dict:
    return {"lower": yhat - z * se, "upper": yhat + z * se}


def _model_se_at(m: dict, x: float) -> float:
    if m.get("_Sxx") and m["_Sxx"] > 0 and m.get("_n", 0) > 2 and math.isfinite(m.get("_s", 0)):
        return m["_s"] * math.sqrt(1 + 1 / m["_n"] + ((x - m["_xbar"]) ** 2) / m["_Sxx"])
    base = m.get("se") if isinstance(m.get("se"), (int, float)) else m.get("rmse", 0)
    last = m.get("last_year", x)
    h = max(0, x - last)
    return (base or 0) * (1 + 0.05 * h)


# ── Models ──

def fit_linear(points: list[dict]) -> dict | None:
    n = len(points)
    if n < 2:
        return None
    xs = [p["year"] for p in points]
    ys = [p["emissions"] for p in points]
    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_xx = sum(x * x for x in xs)
    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        return None
    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n

    def predict(x: float) -> float:
        return slope * x + intercept

    yhats = [predict(x) for x in xs]
    res = [y - yh for y, yh in zip(ys, yhats)]
    s = _rmse(res)
    xbar = sum_x / n
    sxx = sum_xx - sum_x * sum_x / n

    return {
        "name": "Linear OLS",
        "type": "linear",
        "slope": slope,
        "intercept": intercept,
        "r2": _r2(ys, yhats),
        "rmse": s,
        "params": 2,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / n) if n > 2 else s,
        "fitted": yhats,
        "_xbar": xbar,
        "_Sxx": sxx,
        "_n": n,
        "_s": s,
        "last_year": max(xs),
    }


def fit_weighted_linear(points: list[dict], half_life: float = 4) -> dict | None:
    n = len(points)
    if n < 2:
        return None
    xs = [p["year"] for p in points]
    ys = [p["emissions"] for p in points]
    max_year = max(xs)
    decay = math.log(2) / half_life
    w = [math.exp(-decay * (max_year - x)) for x in xs]

    sw = sum(w)
    swx = sum(wi * xi for wi, xi in zip(w, xs))
    swy = sum(wi * yi for wi, yi in zip(w, ys))
    swxy = sum(wi * xi * yi for wi, xi, yi in zip(w, xs, ys))
    swxx = sum(wi * xi * xi for wi, xi in zip(w, xs))
    denom = sw * swxx - swx * swx
    if denom == 0:
        return None
    slope = (sw * swxy - swx * swy) / denom
    intercept = (swy - slope * swx) / sw

    def predict(x: float) -> float:
        return slope * x + intercept

    yhats = [predict(x) for x in xs]
    s = _rmse([y - yh for y, yh in zip(ys, yhats)])
    xbar = _mean(xs)
    sxx = sum((x - xbar) ** 2 for x in xs)

    return {
        "name": "Recency-weighted OLS",
        "type": "weighted",
        "r2": _r2(ys, yhats),
        "rmse": s,
        "params": 2,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / n) if n > 2 else s,
        "fitted": yhats,
        "_xbar": xbar,
        "_Sxx": sxx,
        "_n": n,
        "_s": s,
        "last_year": max(xs),
    }


def _solve3x3(m: list[list[float]], b: list[float]) -> list[float] | None:
    a = [row[:] for row in m]
    v = b[:]
    for col in range(3):
        pivot = col
        for row in range(col + 1, 3):
            if abs(a[row][col]) > abs(a[pivot][col]):
                pivot = row
        a[col], a[pivot] = a[pivot], a[col]
        v[col], v[pivot] = v[pivot], v[col]
        if abs(a[col][col]) < 1e-12:
            return None
        for row in range(col + 1, 3):
            f = a[row][col] / a[col][col]
            for j in range(col, 3):
                a[row][j] -= f * a[col][j]
            v[row] -= f * v[col]
    x = [0.0, 0.0, 0.0]
    for i in range(2, -1, -1):
        s = v[i]
        for j in range(i + 1, 3):
            s -= a[i][j] * x[j]
        x[i] = s / a[i][i]
    return x


def fit_polynomial(points: list[dict], degree: int = 2) -> dict | None:
    n = len(points)
    if n < degree + 1:
        return None
    xs = [p["year"] for p in points]
    ys = [p["emissions"] for p in points]
    k = degree + 1
    xtx = [[0.0] * k for _ in range(k)]
    xty = [0.0] * k
    for i in range(n):
        powers = [xs[i] ** p for p in range(k)]
        for r in range(k):
            xty[r] += powers[r] * ys[i]
            for c in range(k):
                xtx[r][c] += powers[r] * powers[c]
    coeffs = _solve3x3(xtx, xty) if k == 3 else None
    if not coeffs:
        return None

    def predict(x: float) -> float:
        return sum(c * (x ** p) for p, c in enumerate(coeffs))

    yhats = [predict(x) for x in xs]
    s = _rmse([y - yh for y, yh in zip(ys, yhats)])
    return {
        "name": f"Polynomial (deg {degree})",
        "type": "polynomial",
        "r2": _r2(ys, yhats),
        "rmse": s,
        "params": k,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / n) if n > k else s,
        "fitted": yhats,
        "last_year": max(xs),
    }


def fit_log_linear(points: list[dict]) -> dict | None:
    valid = [p for p in points if p["emissions"] > 0]
    if len(valid) < MIN_POINTS:
        return None
    log_pts = [{"year": p["year"], "emissions": math.log(p["emissions"])} for p in valid]
    lin = fit_linear(log_pts)
    if not lin:
        return None
    a = math.exp(lin["intercept"])
    b = lin["slope"]

    def predict(x: float) -> float:
        return a * math.exp(b * x)

    xs = [p["year"] for p in valid]
    ys = [p["emissions"] for p in valid]
    yhats = [predict(x) for x in xs]
    s = _rmse([y - yh for y, yh in zip(ys, yhats)])
    return {
        "name": "Log-linear (exponential)",
        "type": "loglinear",
        "r2": _r2(ys, yhats),
        "rmse": s,
        "params": 2,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / len(valid)),
        "fitted": yhats,
        "last_year": max(xs),
    }


def fit_holt(
    points: list[dict], alpha: float = 0.35, beta: float = 0.15, phi: float = 1.0
) -> dict | None:
    n = len(points)
    if n < MIN_POINTS:
        return None
    sorted_pts = sorted(points, key=lambda p: p["year"])
    level = sorted_pts[0]["emissions"]
    trend = (sorted_pts[-1]["emissions"] - sorted_pts[0]["emissions"]) / max(
        1, sorted_pts[-1]["year"] - sorted_pts[0]["year"]
    )
    fitted = [level]
    for i in range(1, n):
        y = sorted_pts[i]["emissions"]
        prev = level
        level = alpha * y + (1 - alpha) * (level + phi * trend)
        trend = beta * (level - prev) + (1 - beta) * phi * trend
        fitted.append(level + phi * trend)

    last_year = sorted_pts[-1]["year"]
    damped = phi < 1

    def predict(x: float) -> float:
        h = x - last_year
        if h <= 0:
            return level
        if not damped:
            return level + trend * h
        damp_sum = sum(phi ** k for k in range(1, int(h) + 1))
        return level + trend * damp_sum

    ys = [p["emissions"] for p in sorted_pts]
    s = _rmse([y - yh for y, yh in zip(ys, fitted)])
    return {
        "name": "Damped Holt" if damped else "Holt's smoothing",
        "type": "holt_damped" if damped else "holt",
        "r2": _r2(ys, fitted),
        "rmse": s,
        "params": 3 if damped else 2,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / n),
        "fitted": fitted,
        "last_year": last_year,
    }


def fit_ridge_poly(points: list[dict], degree: int = 2, lam: float = 5000) -> dict | None:
    n = len(points)
    if n < degree + 1:
        return None
    xs = [p["year"] for p in points]
    ys = [p["emissions"] for p in points]
    k = degree + 1
    xtx = [[0.0] * k for _ in range(k)]
    xty = [0.0] * k
    for i in range(n):
        powers = [xs[i] ** p for p in range(k)]
        for r in range(k):
            xty[r] += powers[r] * ys[i]
            for c in range(k):
                xtx[r][c] += powers[r] * powers[c]
    for i in range(k):
        xtx[i][i] += lam
    coeffs = _solve3x3(xtx, xty)
    if not coeffs:
        return None

    def predict(x: float) -> float:
        return sum(c * (x ** p) for p, c in enumerate(coeffs))

    yhats = [predict(x) for x in xs]
    s = _rmse([y - yh for y, yh in zip(ys, yhats)])
    return {
        "name": "Ridge polynomial",
        "type": "ridge",
        "r2": _r2(ys, yhats),
        "rmse": s,
        "params": k,
        "predict": predict,
        "se": s * math.sqrt(1 + 1 / n),
        "fitted": yhats,
        "last_year": max(xs),
    }


def _loocv_rmse(points: list[dict], fit_fn: Callable) -> float:
    n = len(points)
    if n < MIN_POINTS:
        return math.inf
    total = 0.0
    count = 0
    for i in range(n):
        train = [p for j, p in enumerate(points) if j != i]
        model = fit_fn(train)
        if not model:
            continue
        err = points[i]["emissions"] - model["predict"](points[i]["year"])
        total += err * err
        count += 1
    return math.sqrt(total / count) if count else math.inf


def _is_sane(model: dict, last: dict, baseline: float | None) -> bool:
    ref = baseline if baseline is not None else last["emissions"]
    ceiling = max(ref * 1.5, last["emissions"] * 1.25)
    for y in (2030, 2040, 2045):
        p = model["predict"](y)
        if not math.isfinite(p):
            return False
        years_out = y - last["year"]
        max_rate = last["emissions"] * (1.12 ** years_out)
        min_rate = last["emissions"] * (0.88 ** years_out)
        if p < 0 or p > ceiling or p > max_rate * 1.1 or p < min_rate * 0.7:
            return False
    return True


def _score_models(
    points: list[dict], last: dict, baseline: float | None
) -> list[dict]:
    n = len(points)
    candidates: list[Callable] = [
        fit_linear,
        lambda p: fit_weighted_linear(p, 4),
    ]
    if n >= 4:
        candidates.append(lambda p: fit_polynomial(p, 2))
    if n >= MIN_POINTS:
        candidates.extend(
            [
                fit_log_linear,
                fit_holt,
                lambda p: fit_holt(p, 0.35, 0.15, 0.85),
            ]
        )
    if n >= 4:
        candidates.append(lambda p: fit_ridge_poly(p, 2, 5000))

    trained = []
    for fit_fn in candidates:
        model = fit_fn(points)
        if not model or not _is_sane(model, last, baseline):
            continue
        cv = _loocv_rmse(points, fit_fn)
        eff = cv if math.isfinite(cv) else (model.get("rmse") or 1) * 1.5
        model["loocv_rmse"] = cv
        model["eff_err"] = eff
        trained.append(model)
    return trained


def _build_ensemble(models: list[dict]) -> dict | None:
    if not models:
        return None
    inv = [1 / max(m.get("eff_err") or m.get("rmse") or 1, 1) for m in models]
    total = sum(inv)
    weights = [w / total for w in inv] if total > 0 else [1 / len(models)] * len(models)

    def predict(x: float) -> float:
        return sum(w * m["predict"](x) for w, m in zip(weights, models))

    def se_predict(x: float) -> float:
        preds = [m["predict"](x) for m in models]
        ens = sum(w * p for w, p in zip(weights, preds))
        variance = sum(w * (p - ens) ** 2 for w, p in zip(weights, preds))
        avg_se = sum(w * _model_se_at(m, x) for w, m in zip(weights, models))
        return math.sqrt(variance + avg_se ** 2)

    return {
        "name": "LOOCV-weighted ensemble",
        "type": "ensemble",
        "models": [
            {"name": m["name"], "weight": weights[i], "loocv_rmse": m.get("loocv_rmse")}
            for i, m in enumerate(models)
        ],
        "weights": weights,
        "predict": predict,
        "se_predict": se_predict,
    }


def _erf(x: float) -> float:
    sign = -1 if x < 0 else 1
    ax = abs(x)
    t = 1 / (1 + 0.3275911 * ax)
    y = 1 - (
        ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
        + 0.254829592
    ) * t * math.exp(-ax * ax)
    return sign * y


def build_forecast(
    points: list[dict],
    baseline_year: int = 2019,
    target_year: int = 2035,
    reduction_pct: float = 0.5,
) -> dict:
    sorted_pts = sorted(points, key=lambda p: p["year"])
    if len(sorted_pts) < 2:
        return {"error": "Insufficient data (need ≥2 years)", "points": len(sorted_pts)}

    train_from = max(2015, sorted_pts[0]["year"])
    train = [p for p in sorted_pts if p["year"] >= train_from]
    last = sorted_pts[-1]
    baseline_pt = next((p for p in sorted_pts if p["year"] == baseline_year), None)
    baseline_emissions = baseline_pt["emissions"] if baseline_pt else None
    train_set = train if len(train) >= MIN_POINTS else sorted_pts

    models = _score_models(train_set, last, baseline_emissions)
    if not models:
        lin = fit_linear(train_set)
        if lin:
            lin["loocv_rmse"] = _loocv_rmse(train_set, fit_linear)
            lin["eff_err"] = lin["loocv_rmse"]
            models = [lin]

    def err_of(m: dict) -> float:
        return m.get("eff_err") or m.get("loocv_rmse") or m.get("rmse") or math.inf

    best = min(models, key=err_of) if models else fit_linear(sorted_pts)
    ensemble = _build_ensemble(models) if len(models) >= 2 else None
    primary = ensemble or best

    if not primary:
        return {"error": "Could not fit models", "points": len(sorted_pts)}

    forecast_years = list(range(last["year"], target_year + 1))

    def se_at(y: int) -> float:
        if "se_predict" in primary:
            return primary["se_predict"](y)
        return _model_se_at(primary, y)

    median = [round(max(0, primary["predict"](y))) for y in forecast_years]
    lower = [
        round(max(0, _predict_interval(median[i], se_at(y))["lower"]))
        for i, y in enumerate(forecast_years)
    ]
    upper = [
        round(max(0, _predict_interval(median[i], se_at(y))["upper"]))
        for i, y in enumerate(forecast_years)
    ]

    target_val = (
        commitment_target(baseline_emissions, reduction_pct)
        if baseline_emissions
        else None
    )
    proj_mid = round(max(0, primary["predict"](min(2030, target_year))))
    proj_end = round(max(0, primary["predict"](target_year)))
    gap = (proj_end - target_val) if target_val is not None else None

    goal_reduction_pct = round(reduction_pct * 100)
    proj_reduction_pct = (
        round(((baseline_emissions - proj_end) / baseline_emissions) * 100)
        if baseline_emissions and baseline_emissions > 0
        else None
    )

    attainment_prob = None
    if target_val is not None and gap is not None:
        se_end = se_at(target_year)
        z = gap / max(se_end, 1)
        attainment_prob = _clamp(0.5 * (1 - _erf(z / math.sqrt(2))), 0, 1)

    return {
        "train_years": len(train),
        "last_year": last["year"],
        "models": [
            {
                "name": m["name"],
                "r2": round(m.get("r2") or 0, 3),
                "rmse": round(m.get("rmse") or 0, 1),
                "loocv_rmse": (
                    round(m["loocv_rmse"], 1)
                    if math.isfinite(m.get("loocv_rmse", math.inf))
                    else None
                ),
                "params": m.get("params"),
            }
            for m in models
        ],
        "best_model": best["name"] if best else "Linear OLS",
        "ensemble": ensemble is not None,
        "primary_model": primary["name"],
        "r2": best.get("r2") if best else None,
        "rmse": best.get("rmse") if best else None,
        "forecast_years": forecast_years,
        "median": median,
        "lower": lower,
        "upper": upper,
        "projections": {"mid": proj_mid, "end": proj_end, str(target_year): proj_end},
        "target": target_val,
        "gap": gap,
        "on_track": gap is not None and gap <= 0,
        "proj_reduction_pct": proj_reduction_pct,
        "goal_reduction_pct": goal_reduction_pct,
        "attainment_prob": attainment_prob,
        "baseline_emissions": baseline_emissions,
        "target_year": target_year,
        "baseline_year": baseline_year,
        "reduction_pct": reduction_pct,
    }
