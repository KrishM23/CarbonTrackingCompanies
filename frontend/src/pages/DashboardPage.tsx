import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtShort, type DashboardData } from "../api";
import { ForecastChart, ScopeFlowChart } from "../components/ForecastChart";
import { Gauge } from "../components/Gauge";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [seg, setSeg] = useState<"trajectory" | "scopes" | "intensity" | "actions">("trajectory");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="empty">Loading overview…</p>;

  const { company, series, metrics, forecast, insights } = data;
  const needsData = series.length < 2;

  const download = async () => {
    setPdfBusy(true);
    try {
      await api.downloadPdf();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setPdfBusy(false);
    }
  };

  const goalPct = metrics?.pct_of_goal ?? 0;
  const quality = insights?.quality.score ?? 0;
  const attain =
    forecast.attainment_prob != null ? Math.round(forecast.attainment_prob * 1000) / 10 : 0;
  const intensityBetter = insights?.intensity.better_than_peer;

  const totalScope =
    (metrics?.scope.scope1 || 0) + (metrics?.scope.scope2 || 0) + (metrics?.scope.scope3 || 0) || 1;

  return (
    <>
      <div className="page-head-row">
        <div className="page-title">
          <button className="back-circle" type="button" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1>Emissions Control Center</h1>
            <div className="sub">
              {company.name}
              {company.industry ? ` · ${company.industry}` : ""} · Scope 1–3 intelligence
            </div>
          </div>
        </div>
        <div className="seg-toggle" role="tablist">
          {(
            [
              ["trajectory", "Trajectory"],
              ["scopes", "Scopes"],
              ["intensity", "Intensity"],
              ["actions", "Actions"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={seg === id ? "active" : ""}
              onClick={() => setSeg(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {needsData ? (
        <div className="card">
          <h3 style={{ fontWeight: 400, marginBottom: 8 }}>Finish setup</h3>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Add at least two inventory years to unlock the control center.
          </p>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link className="btn btn-primary" to="/data">
              Add inventory
            </Link>
            <Link className="btn btn-secondary" to="/settings">
              Target settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="dash-layout">
          <div className="dash-main">
            <div className="kpi-grid">
              <div className="card bento-kpi">
                <div className="card-head">
                  <div>
                    <div className="card-label">Latest inventory</div>
                    <div className="card-metric">
                      {metrics ? fmtShort(metrics.latest.emissions) : "—"}
                      <span>t</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/data")}>
                    ↗
                  </button>
                </div>
              </div>
              <div className="card bento-kpi">
                <div className="card-head">
                  <div>
                    <div className="card-label">{company.target_year} forecast</div>
                    <div className="card-metric">
                      {forecast.projections ? fmtShort(forecast.projections.end) : "—"}
                      <span>t</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/simulator")}>
                    ↗
                  </button>
                </div>
              </div>
              <div className="card bento-kpi">
                <div className="card-head">
                  <div>
                    <div className="card-label">Data quality</div>
                    <div className="card-metric">
                      {quality}
                      <span>/100</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/roadmap")}>
                    ↗
                  </button>
                </div>
              </div>
            </div>

            <div className="chart-grid">
              <div className="card bento-chart">
                <div className="card-head">
                  <div>
                    <div className="card-label">Emissions trajectory</div>
                    <div className="chart-stat">
                      {forecast.attainment_prob != null
                        ? `${Math.round(forecast.attainment_prob * 100)}%`
                        : "—"}
                      <span>attainment odds</span>
                    </div>
                  </div>
                  <span className={`pill ${forecast.on_track ? "on" : "off"}`}>
                    {forecast.on_track ? "On track" : "Gap"}
                  </span>
                </div>
                <ForecastChart
                  series={series}
                  forecast={forecast}
                  targetYear={company.target_year}
                  targetValue={metrics?.target_emissions}
                  compact
                />
              </div>
              <div className="card bento-chart">
                <div className="card-head">
                  <div>
                    <div className="card-label">Scope flow analysis</div>
                    <div className="chart-stat">
                      {metrics ? fmtShort(metrics.latest.emissions) : "—"}
                      <span>latest mix</span>
                    </div>
                  </div>
                </div>
                <ScopeFlowChart series={series} />
              </div>
            </div>

            <div className="gauge-grid">
              <div className="card bento-gauge">
                <Gauge
                  value={Math.min(100, Math.max(0, goalPct))}
                  label="Goal progress"
                  color={goalPct >= 70 ? "green" : goalPct >= 40 ? "amber" : "orange"}
                />
              </div>
              <div className="card bento-gauge">
                <Gauge
                  value={quality}
                  label="Disclosure readiness"
                  color={quality >= 75 ? "green" : quality >= 50 ? "amber" : "orange"}
                />
              </div>
              <div className="card bento-gauge">
                <Gauge
                  value={attain}
                  label={`${company.target_year} attainment`}
                  color={attain >= 60 ? "green" : attain >= 30 ? "amber" : "orange"}
                />
              </div>
            </div>
          </div>

          <aside className="card bento-side">
            <div className="bento-side-inner">
              <div className="card-label">Focus panel</div>
              <h3>
                {seg === "trajectory" && "Forecast vs target"}
                {seg === "scopes" && "Scope breakdown"}
                {seg === "intensity" && "Carbon intensity"}
                {seg === "actions" && "Priority actions"}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>
                {seg === "trajectory" &&
                  (insights?.headlines[0] || "Ensemble path against your reduction commitment.")}
                {seg === "scopes" && `Inventory mix for ${metrics?.latest.year ?? "latest year"}.`}
                {seg === "intensity" &&
                  (insights?.intensity.peer_label
                    ? `Vs ${insights.intensity.peer_label} peer band.`
                    : "Add headcount & revenue in Settings.")}
                {seg === "actions" && (insights?.roadmap.summary || "Open the full roadmap.")}
              </p>

              {seg === "scopes" && metrics && (
                <div className="scope-bars">
                  {[
                    { key: "s1", label: "Scope 1 · Direct", val: metrics.scope.scope1 },
                    { key: "s2", label: "Scope 2 · Electricity", val: metrics.scope.scope2 },
                    { key: "s3", label: "Scope 3 · Value chain", val: metrics.scope.scope3 },
                  ].map((s) => (
                    <div className="scope-row" key={s.key}>
                      <div className="scope-row-top">
                        <span>{s.label}</span>
                        <span>{fmtShort(s.val)} t</span>
                      </div>
                      <div className="scope-track">
                        <div
                          className={`scope-fill ${s.key}`}
                          style={{ width: `${(s.val / totalScope) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {seg === "intensity" && insights?.intensity && (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  <div className="card" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="card-label">Per employee</div>
                    <div className="card-metric" style={{ fontSize: "1.6rem" }}>
                      {insights.intensity.per_employee ?? "—"}
                      <span>t</span>
                    </div>
                  </div>
                  <div className="card" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="card-label">Per $M revenue</div>
                    <div className="card-metric" style={{ fontSize: "1.6rem" }}>
                      {insights.intensity.per_revenue_m ?? "—"}
                      <span>t</span>
                    </div>
                    {insights.intensity.vs_peer_pct != null && (
                      <span
                        className={`pill ${intensityBetter ? "on" : "off"}`}
                        style={{ marginTop: 8 }}
                      >
                        {intensityBetter ? "" : "+"}
                        {insights.intensity.vs_peer_pct}% vs peers
                      </span>
                    )}
                  </div>
                </div>
              )}

              {seg === "trajectory" && (
                <div className="insight-list" style={{ marginTop: 12 }}>
                  {(insights?.headlines || []).slice(0, 4).map((h) => (
                    <div className="insight-item" key={h}>
                      <span className="dot" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              )}

              {seg === "actions" && (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {(insights?.roadmap.actions || []).slice(0, 3).map((a) => (
                    <div className="roadmap-card" key={a.id} style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div className="meta">
                        <span className={`scope-tag s${a.scope}`}>S{a.scope}</span>
                        <span className={`pill ${a.priority === "high" ? "off" : "warn"}`}>
                          {a.priority}
                        </span>
                      </div>
                      <strong style={{ fontWeight: 500 }}>{a.title}</strong>
                      <p>~{fmtShort(a.impact_t)} t · {a.owner}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="side-actions">
                <button className="btn btn-primary" type="button" onClick={download} disabled={pdfBusy}>
                  {pdfBusy ? "…" : "Export PDF"}
                </button>
                <Link className="btn btn-secondary" to="/simulator">
                  Simulate
                </Link>
                <button className="side-fab" type="button" onClick={() => navigate("/roadmap")} title="Roadmap">
                  →
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
