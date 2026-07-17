import { FormEvent, useEffect, useState } from "react";
import { api, type Company } from "../api";
import { useAuth } from "../AuthContext";

export function SettingsPage() {
  const { company, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    industry: "",
    baseline_year: 2019,
    target_year: 2035,
    reduction_pct: 50,
    employee_count: 0,
    annual_revenue_m: 0,
    framework: "GHG Protocol",
    hq_country: "United States",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name,
        industry: company.industry || "",
        baseline_year: company.baseline_year,
        target_year: company.target_year,
        reduction_pct: Math.round(company.reduction_pct * 100),
        employee_count: company.employee_count || 0,
        annual_revenue_m: company.annual_revenue_m || 0,
        framework: company.framework || "GHG Protocol",
        hq_country: company.hq_country || "United States",
      });
    }
  }, [company]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const body: Partial<Company> = {
        name: form.name,
        industry: form.industry,
        baseline_year: form.baseline_year,
        target_year: form.target_year,
        reduction_pct: form.reduction_pct / 100,
        employee_count: form.employee_count,
        annual_revenue_m: form.annual_revenue_m,
        framework: form.framework,
        hq_country: form.hq_country,
      };
      await api.updateCompany(body);
      await refresh();
      setMsg("Company profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Workspace</div>
        <h2 style={{ fontWeight: 300 }}>Company & target</h2>
        <p>
          Lock the baseline commitment and organizational context used for intensity metrics and
          peer comparisons.
        </p>
      </header>

      <section className="panel" style={{ maxWidth: 640 }}>
        <form className="form" onSubmit={onSubmit}>
          {error && <div className="error">{error}</div>}
          {msg && <p style={{ color: "var(--accent-2)", fontWeight: 600 }}>{msg}</p>}
          <div className="field">
            <label>Company name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="Industrial goods"
              />
            </div>
            <div className="field">
              <label>HQ country</label>
              <input
                value={form.hq_country}
                onChange={(e) => setForm({ ...form, hq_country: e.target.value })}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Employees (FTE)</label>
              <input
                type="number"
                min={0}
                value={form.employee_count}
                onChange={(e) => setForm({ ...form, employee_count: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Annual revenue ($M)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.annual_revenue_m}
                onChange={(e) => setForm({ ...form, annual_revenue_m: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="field">
            <label>Reporting framework</label>
            <select
              value={form.framework}
              onChange={(e) => setForm({ ...form, framework: e.target.value })}
            >
              <option>GHG Protocol</option>
              <option>SBTi-aligned</option>
              <option>ISO 14064</option>
              <option>CDP-ready</option>
            </select>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>Baseline year</label>
              <input
                type="number"
                value={form.baseline_year}
                onChange={(e) => setForm({ ...form, baseline_year: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Target year</label>
              <input
                type="number"
                value={form.target_year}
                onChange={(e) => setForm({ ...form, target_year: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Reduction %</label>
              <input
                type="number"
                min={5}
                max={100}
                value={form.reduction_pct}
                onChange={(e) => setForm({ ...form, reduction_pct: Number(e.target.value) })}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>
    </>
  );
}
