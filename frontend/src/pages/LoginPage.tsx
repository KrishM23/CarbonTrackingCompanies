import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

function LogoMark() {
  return (
    <div className="logo" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l2.2 6.2L20.5 11l-6.3 1.8L12 19l-2.2-6.2L3.5 11l6.3-1.8L12 3z"
          stroke="#f4f5f7"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <LogoMark />
        <h1>CarbonTrack</h1>
        <p className="lead">
          Emissions control for mid-size companies — forecast, simulate, and prove progress.
        </p>
        <div className="auth-features">
          <span>
            <i /> Ensemble forecasts with prediction intervals
          </span>
          <span>
            <i /> What-if lab for electrification & clean power
          </span>
          <span>
            <i /> Board PDF, roadmap, and peer intensity
          </span>
        </div>
        <form className="form" onSubmit={onSubmit}>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setEmail("demo@acme.corp");
              setPassword("demo1234");
            }}
          >
            Use demo account
          </button>
        </form>
        <p className="switch">
          New company? <Link to="/signup">Start workspace</Link>
        </p>
      </div>
    </div>
  );
}
