import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { INDUSTRIES } from "../constants";

export function SignupPage() {
  const { signup, user, loading } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    company_name: "",
    industry: "Manufacturing",
    baseline_year: 2019,
    target_year: 2035,
    reduction_pct: 50,
    employee_count: 0,
    annual_revenue_m: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      setBusy(false);
      return;
    }
    if (form.target_year <= form.baseline_year) {
      setError("Target year must be after the baseline year.");
      setBusy(false);
      return;
    }
    try {
      await signup({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim(),
        industry: form.industry.trim(),
        baseline_year: form.baseline_year,
        target_year: form.target_year,
        reduction_pct: form.reduction_pct / 100,
        employee_count: form.employee_count,
        annual_revenue_m: form.annual_revenue_m,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <BrandLogo size="md" withWordmark />
        <h1 className="auth-title">Set up your company workspace</h1>
        <p className="lead">
          One company per account. Start with your reduction target, then add yearly emissions and
          run scenarios.
        </p>
        <form className="form" onSubmit={onSubmit} noValidate>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="company_name">Company name</label>
            <input
              id="company_name"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="Acme Manufacturing"
              required
              autoComplete="organization"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="industry">Industry</label>
              <select
                id="industry"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="full_name">Your name</label>
              <input
                id="full_name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                autoComplete="name"
                placeholder="Sustainability / ops lead"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="signup_email">Work email</label>
            <input
              id="signup_email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
          <div className="field">
            <label htmlFor="signup_password">Password</label>
            <input
              id="signup_password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Employees (optional)</label>
              <input
                type="number"
                min={0}
                value={form.employee_count || ""}
                onChange={(e) => set("employee_count", Number(e.target.value) || 0)}
                placeholder="850"
              />
            </div>
            <div className="field">
              <label>Revenue $M (optional)</label>
              <input
                type="number"
                min={0}
                value={form.annual_revenue_m || ""}
                onChange={(e) => set("annual_revenue_m", Number(e.target.value) || 0)}
                placeholder="420"
              />
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>Baseline year</label>
              <input
                type="number"
                value={form.baseline_year}
                onChange={(e) => set("baseline_year", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Target year</label>
              <input
                type="number"
                value={form.target_year}
                onChange={(e) => set("target_year", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Reduction %</label>
              <input
                type="number"
                min={5}
                max={100}
                value={form.reduction_pct}
                onChange={(e) => set("reduction_pct", Number(e.target.value))}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create company workspace"}
          </button>
        </form>
        <p className="switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
