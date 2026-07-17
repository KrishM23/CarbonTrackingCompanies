import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtShort, type Insights } from "../api";
import { useAuth } from "../AuthContext";

export function RoadmapPage() {
  const { company } = useAuth();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .insights()
      .then(setInsights)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="panel">
        <div className="error">{error}</div>
        <p className="panel-sub" style={{ marginTop: 12 }}>
          Add inventory years to unlock roadmap intelligence.
        </p>
        <Link className="btn btn-primary" to="/data">
          Go to inventory
        </Link>
      </div>
    );
  }
  if (!insights) return <p className="empty">Building your roadmap…</p>;

  const { quality, compliance, roadmap, intensity } = insights;

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Decision support</div>
        <h2 style={{ fontWeight: 300 }}>
          {company?.name ? `${company.name} roadmap` : "Roadmap & readiness"}
        </h2>
        <p>
          Prioritized abatement actions, disclosure checklist, and data quality. The package
          sustainability leads take to the board and enterprise customers.
        </p>
      </header>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <h3>Data quality</h3>
          <p className="panel-sub">Score used for disclosure readiness conversations.</p>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div className="quality-ring" style={{ ["--pct" as string]: quality.score }}>
              <span>{quality.score}</span>
            </div>
            <div>
              <div className="pill neutral" style={{ marginBottom: 8 }}>
                {quality.grade}
              </div>
              <div className="check-list">
                {quality.checks.map((c) => (
                  <div key={c.id} style={{ fontSize: "0.9rem", color: c.ok ? "var(--ink-soft)" : "var(--muted)" }}>
                    {c.ok ? "✓" : "○"} {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="insight-list" style={{ marginTop: 16 }}>
            {quality.tips.map((t) => (
              <div className="insight-item" key={t}>
                <span className="dot" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Disclosure readiness</h3>
          <p className="panel-sub">
            {compliance.ready_count}/{compliance.total} checks ready · {compliance.pct}%
          </p>
          <div className="check-list">
            {compliance.items.map((item) => (
              <div className="check-item" key={item.id}>
                <div>
                  <div>{item.label}</div>
                  <div className="fw">{item.framework}</div>
                </div>
                <span className={`pill ${item.status === "ready" ? "on" : "warn"}`}>
                  {item.status === "ready" ? "Ready" : "Todo"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="hero-cta">
          <div>
            <h3>Abatement roadmap</h3>
            <p className="panel-sub">{roadmap.summary}</p>
          </div>
          <Link className="btn btn-primary" to="/simulator">
            Stress-test in simulator
          </Link>
        </div>

        {(["Near-term", "Mid-term", "Long-term"] as const).map((phase) => {
          const actions = roadmap.actions.filter((a) => a.phase === phase);
          if (!actions.length) return null;
          return (
            <div key={phase} style={{ marginTop: 20 }}>
              <h4
                style={{
                  fontWeight: 400,
                  fontSize: "1.05rem",
                  marginBottom: 10,
                }}
              >
                {phase}
              </h4>
              <div className="grid-2">
                {actions.map((a) => (
                  <div className="roadmap-card" key={a.id}>
                    <div className="meta">
                      <span className={`scope-tag s${a.scope}`}>S{a.scope}</span>
                      <span className={`pill ${a.priority === "high" ? "off" : "warn"}`}>
                        {a.priority}
                      </span>
                      <span className="pill neutral">{a.years}</span>
                    </div>
                    <strong style={{ fontWeight: 500, fontSize: "1.08rem" }}>
                      {a.title}
                    </strong>
                    <p>{a.detail}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "var(--green)" }}>
                        ~{fmtShort(a.impact_t)} t ({a.impact_pct}% of inventory)
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        {a.owner} · {a.cost_band}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {intensity.vs_peer_pct != null && (
        <section className="panel">
          <h3>Peer intensity context</h3>
          <p className="panel-sub">
            Illustrative mid-market band for {intensity.peer_label}. Useful for RFP and customer
            questionnaires, not a certified ranking.
          </p>
          <div className="grid-3">
            <div className="metric">
              <div className="label">Your intensity</div>
              <div className="value">{intensity.per_revenue_m ?? "—"}</div>
              <div className="hint">t CO₂e / $M revenue</div>
            </div>
            <div className="metric">
              <div className="label">Peer band</div>
              <div className="value">{intensity.peer_t_per_m}</div>
              <div className="hint">{intensity.peer_label}</div>
            </div>
            <div className="metric">
              <div className="label">Vs peers</div>
              <div className="value">
                {intensity.better_than_peer ? "" : "+"}
                {intensity.vs_peer_pct}%
              </div>
              <div className="hint">
                <span className={`pill ${intensity.better_than_peer ? "on" : "off"}`}>
                  {intensity.better_than_peer ? "Better than peers" : "Above peer band"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
