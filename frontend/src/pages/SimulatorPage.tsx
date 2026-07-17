import { useEffect, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  fmtShort,
  type LeverDef,
  type Levers,
  type SavedScenario,
  type ScenarioPreset,
  type ScenarioResult,
} from "../api";
import { useAuth } from "../AuthContext";

const DEFAULT_LEVERS: Levers = {
  scope1_cut: 0,
  scope2_cut: 0,
  scope3_cut: 0,
  ramp_years: 12,
};

export function SimulatorPage() {
  const { company } = useAuth();
  const [levers, setLevers] = useState<Levers>(DEFAULT_LEVERS);
  const [presets, setPresets] = useState<ScenarioPreset[]>([]);
  const [defs, setDefs] = useState<LeverDef[]>([]);
  const [activePreset, setActivePreset] = useState("status-quo");
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [saveName, setSaveName] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSaved = () => api.listSavedScenarios().then(setSaved).catch(() => undefined);

  useEffect(() => {
    api.scenarioMeta().then((meta) => {
      setPresets(meta.presets);
      setDefs(meta.lever_defs);
    });
    loadSaved();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    api
      .runScenario(levers)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [levers]);

  const applyPreset = (p: ScenarioPreset) => {
    setLevers({ ...p.levers });
    setActivePreset(p.id);
  };

  const saveCurrent = async () => {
    const name = saveName.trim() || `Scenario ${new Date().toLocaleDateString()}`;
    setMsg("");
    try {
      await api.saveScenario({ name, ...levers });
      setSaveName("");
      setMsg(`Saved “${name}” to your scenario library.`);
      await loadSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save scenario");
    }
  };

  const chartData =
    result?.years.map((y, i) => ({
      year: y,
      baseline: result.baseline[i],
      scenario: result.scenario[i],
      low: result.scenario_low[i],
      high: result.scenario_high[i],
      commitment: result.commitment[i],
    })) ?? [];

  const maxBar = Math.max(
    result?.baseline_end ?? 1,
    result?.scenario_end ?? 1,
    result?.target ?? 1,
    1
  );

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">What-if lab</div>
        <h2 style={{ fontWeight: 300 }}>
          {company?.name ? `${company.name} simulator` : "Intervention simulator"}
        </h2>
        <p>
          Coupled Scope 1, 2, and 3 scenario engine with load-shift rebound and capital-turnover
          S-curves. Save board options side by side against your {company?.target_year ?? "target"}{" "}
          commitment.
        </p>
      </header>

      {error && (
        <div className="panel">
          <div className="error">{error}</div>
        </div>
      )}

      {!error && (
        <>
          <div className="sim-layout">
            <section className="panel">
              <p style={{ fontWeight: 800, marginBottom: 10 }}>Scenario controls</p>
              <div className="sim-presets">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`sim-preset ${activePreset === p.id ? "active" : ""}`}
                    title={p.desc}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {defs.map((d) => (
                <div className="lever" key={d.id}>
                  <div className="lever-head">
                    <label htmlFor={d.id}>
                      {d.scope != null && (
                        <span className={`scope-tag s${d.scope}`}>S{d.scope}</span>
                      )}
                      {d.label}
                    </label>
                    <output htmlFor={d.id}>
                      {levers[d.id]}
                      {d.unit || "%"}
                    </output>
                  </div>
                  <input
                    id={d.id}
                    type="range"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={levers[d.id]}
                    onChange={(e) => {
                      setActivePreset("");
                      setLevers({ ...levers, [d.id]: Number(e.target.value) });
                    }}
                  />
                  <p className="sub">{d.sub}</p>
                </div>
              ))}
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="saveName">Save this path</label>
                <input
                  id="saveName"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Board option A, electrify fleet"
                />
              </div>
              <div className="actions">
                <button className="btn btn-primary" type="button" onClick={saveCurrent}>
                  Save scenario
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setLevers(DEFAULT_LEVERS);
                    setActivePreset("status-quo");
                  }}
                >
                  Reset
                </button>
              </div>
              {msg && (
                <p style={{ marginTop: 10, color: "var(--accent-2)", fontWeight: 600 }}>{msg}</p>
              )}
            </section>

            <div>
              <section className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700 }}>
                      Projected for {result?.target_year ?? "…"}
                    </p>
                    <div className="headline" style={{ marginTop: 8 }}>
                      {result ? fmtShort(result.scenario_end) : busy ? "…" : "—"}
                      <span>t CO₂e</span>
                    </div>
                  </div>
                  {result && (
                    <span className={`pill ${result.on_track_scenario ? "on" : "off"}`}>
                      {result.on_track_scenario ? "Reaches goal" : "Still short"}
                    </span>
                  )}
                </div>
                {result && result.improvement > 500 && (
                  <p style={{ marginTop: 8, color: "var(--accent-2)", fontWeight: 700 }}>
                    ↓ {fmtShort(result.improvement)} vs current trend
                  </p>
                )}
                {result && (
                  <div className="bars">
                    <div className="bar-row">
                      <span>Current trend</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill trend"
                          style={{ width: `${(result.baseline_end / maxBar) * 100}%` }}
                        />
                      </div>
                      <span>{fmtShort(result.baseline_end)}</span>
                    </div>
                    <div className="bar-row">
                      <span>Your scenario</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill scenario"
                          style={{ width: `${(result.scenario_end / maxBar) * 100}%` }}
                        />
                      </div>
                      <span>{fmtShort(result.scenario_end)}</span>
                    </div>
                    <div className="bar-row">
                      <span>Goal</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill goal"
                          style={{ width: `${(result.target / maxBar) * 100}%` }}
                        />
                      </div>
                      <span>{fmtShort(result.target)}</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="panel">
                <h3>Trajectory</h3>
                <p className="panel-sub">Trend, scenario path, and structural sensitivity band.</p>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={(v) => fmtShort(Number(v))}
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        width={48}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [`${fmtShort(v)} t`, name]}
                        contentStyle={{
                          background: "#16181f",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#a8adb8" }} />
                      <Line type="monotone" dataKey="high" stroke="rgba(61,214,140,0.3)" dot={false} name="Optimistic" />
                      <Line type="monotone" dataKey="low" stroke="rgba(61,214,140,0.3)" dot={false} name="Pessimistic" />
                      <Line type="monotone" dataKey="baseline" stroke="#6b7280" strokeWidth={2} dot={false} name="Trend" />
                      <Line type="monotone" dataKey="scenario" stroke="#3dd68c" strokeWidth={2.5} dot={false} name="Scenario" />
                      <Line
                        type="monotone"
                        dataKey="commitment"
                        stroke="#5b8def"
                        strokeDasharray="6 4"
                        strokeWidth={1.5}
                        dot={false}
                        name="Target"
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>

          {saved.length > 0 && (
            <section className="panel">
              <h3>Saved scenarios</h3>
              <p className="panel-sub">Compare board options without re-tuning sliders.</p>
              <div className="saved-grid">
                {saved.map((s) => (
                  <div className="saved-card" key={s.id}>
                    <h4>{s.name}</h4>
                    <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: 8 }}>
                      S1 {s.scope1_cut}% · S2 {s.scope2_cut}% · S3 {s.scope3_cut}% · {s.ramp_years} yr
                    </p>
                    <div className="value" style={{ fontSize: "1.4rem", fontWeight: 300 }}>
                      {fmtShort(s.scenario_end)}
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", marginLeft: 6 }}>t</span>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className={`pill ${s.on_track ? "on" : "off"}`}>
                        {s.on_track ? "On track" : "Short"}
                      </span>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                        onClick={() => {
                          setLevers({
                            scope1_cut: s.scope1_cut,
                            scope2_cut: s.scope2_cut,
                            scope3_cut: s.scope3_cut,
                            ramp_years: s.ramp_years,
                          });
                          setActivePreset("");
                        }}
                      >
                        Load
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                        onClick={async () => {
                          await api.deleteSavedScenario(s.id);
                          await loadSaved();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
