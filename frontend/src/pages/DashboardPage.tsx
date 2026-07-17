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

  const goalPct = Math.min(100, Math.max(0, metrics?.pct_of_goal ?? 0));
  const quality = insights?.quality.score ?? 0;
  const attain =
    forecast.attainment_prob != null ? Math.round(forecast.attainment_prob * 1000) / 10 : 0;
  const intensityBetter = insights?.intensity.better_than_peer;
  const profileGaps: string[] = [];
  if (!company.employee_count) profileGaps.push("headcount");
  if (!company.annual_revenue_m) profileGaps.push("revenue");
  if (!company.industry) profileGaps.push("industry");

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
            <h1>{company.name}</h1>
            <div className="sub">
              Emissions control center
              {company.industry ? ` · ${company.industry}` : ""}
              {company.hq_country ? ` · ${company.hq_country}` : ""} · Scopes 1, 2 & 3
            </div>
          </div>
        </div>
        <div className="seg-toggle" role="tablist" aria-label="Focus panel">
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
              role="tab"
              aria-selected={seg === id}
              className={seg === id ? "active" : ""}
              onClick={() => setSeg(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {needsData ? (
        <div className="card setup-card">
          <h3 style={{ fontWeight: 400, marginBottom: 8 }}>Finish {company.name}&apos;s setup</h3>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Add at least two inventory years to unlock forecasts, peer intensity, and board PDF
            export.
          </p>
          <ol className="setup-steps">
            <li>Confirm baseline, target year, and reduction % in Settings</li>
            <li>Enter annual Scope 1, 2, and 3 inventory (or upload CSV)</li>
            <li>Run a what-if scenario and export the company PDF</li>
          </ol>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="btn btn-primary" to="/data">
              Add inventory
            </Link>
            <Link className="btn btn-secondary" to="/settings">
              Company & target
            </Link>
          </div>
        </div>
      ) : (
        <>
          {profileGaps.length > 0 && (
            <div className="profile-banner">
              <span>
                Add {profileGaps.join(", ")} in Settings to unlock peer intensity for {company.name}.
              </span>
              <Link className="btn btn-secondary" to="/settings">
                Complete profile
              </Link>
            </div>
          )}
        <div className="dash-layout">
          <div className="dash-main">
            <div className="kpi-grid">
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-label">Latest inventory</div>
                    <div className="card-metric">
                      {metrics ? fmtShort(metrics.latest.emissions) : "—"}
                      <span>t</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/data")} aria-label="Open inventory">
                    ↗
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-label">{company.target_year} forecast</div>
                    <div className="card-metric">
                      {forecast.projections ? fmtShort(forecast.projections.end) : "—"}
                      <span>t</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/simulator")} aria-label="Open simulator">
                    ↗
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-label">Data quality</div>
                    <div className="card-metric">
                      {quality}
                      <span>/100</span>
                    </div>
                  </div>
                  <button className="card-arrow" type="button" onClick={() => navigate("/roadmap")} aria-label="Open roadmap">
                    ↗
                  </button>
                </div>
              </div>
            </div>

            <div className="chart-grid">
              <div className="card chart-card">
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
              <div className="card chart-card">
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
              <div className="card gauge-card">
                <Gauge
                  value={goalPct}
                  label="Goal progress"
                  color={goalPct >= 70 ? "green" : goalPct >= 40 ? "amber" : "orange"}
                />
              </div>
              <div className="card gauge-card">
                <Gauge
                  value={quality}
                  label="Disclosure readiness"
                  color={quality >= 75 ? "green" : quality >= 50 ? "amber" : "orange"}
                />
              </div>
              <div className="card gauge-card">
                <Gauge
                  value={attain}
                  label={`${company.target_year} attainment`}
                  color={attain >= 60 ? "green" : attain >= 30 ? "amber" : "orange"}
                />
              </div>
            </div>
          </div>

          <aside className="card side-panel">
            <div className="side-panel-scroll">
              <div className="card-label">Focus panel</div>
              <h3 className="side-title">
                {seg === "trajectory" && "Forecast vs target"}
                {seg === "scopes" && "Scope breakdown"}
                {seg === "intensity" && "Carbon intensity"}
                {seg === "actions" && "Priority actions"}
              </h3>
              <p className="side-copy">
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
                          style={{ width: `${Math.min(100, (s.val / totalScope) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {seg === "intensity" && (
                <div className="side-stack">
                  {insights?.intensity ? (
                    <>
                      <div className="mini-stat">
                        <div className="card-label">Per employee</div>
                        <div className="card-metric sm">
                          {insights.intensity.per_employee ?? "—"}
                          <span>t</span>
                        </div>
                      </div>
                      <div className="mini-stat">
                        <div className="card-label">Per $M revenue</div>
                        <div className="card-metric sm">
                          {insights.intensity.per_revenue_m ?? "—"}
                          <span>t</span>
                        </div>
                        {insights.intensity.vs_peer_pct != null && (
                          <span className={`pill ${intensityBetter ? "on" : "off"}`}>
                            {intensityBetter ? "" : "+"}
                            {insights.intensity.vs_peer_pct}% vs peers
                          </span>
                        )}
                      </div>
                      {(!company.employee_count || !company.annual_revenue_m) && (
                        <Link className="btn btn-secondary" to="/settings">
                          Add headcount & revenue
                        </Link>
                      )}
                    </>
                  ) : (
                    <Link className="btn btn-secondary" to="/settings">
                      Complete company profile
                    </Link>
                  )}
                </div>
              )}

              {seg === "trajectory" && (
                <div className="insight-list">
                  {(insights?.headlines || []).slice(0, 4).map((h) => (
                    <div className="insight-item" key={h}>
                      <span className="dot" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              )}

              {seg === "actions" && (
                <div className="side-stack">
                  {(insights?.roadmap.actions || []).slice(0, 3).map((a) => (
                    <div className="roadmap-card" key={a.id}>
                      <div className="meta">
                        <span className={`scope-tag s${a.scope}`}>S{a.scope}</span>
                        <span className={`pill ${a.priority === "high" ? "off" : "warn"}`}>
                          {a.priority}
                        </span>
                      </div>
                      <strong>{a.title}</strong>
                      <p>
                        ~{fmtShort(a.impact_t)} t · {a.owner}
                      </p>
                    </div>
                  ))}
                  <Link className="btn btn-secondary" to="/roadmap">
                    Full roadmap
                  </Link>
                </div>
              )}
            </div>

            <div className="side-actions">
              <button className="btn btn-primary" type="button" onClick={download} disabled={pdfBusy}>
                {pdfBusy ? "Preparing…" : "Export PDF"}
              </button>
              <Link className="btn btn-secondary" to="/simulator">
                Simulate
              </Link>
              <button
                className="side-fab"
                type="button"
                onClick={() => navigate("/roadmap")}
                title="Roadmap"
                aria-label="Open roadmap"
              >
                →
              </button>
            </div>
          </aside>
        </div>
        </>
      )}
    </>
  );
}
