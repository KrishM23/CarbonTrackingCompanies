import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
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

export function AppLayout() {
  const { user, company, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <LogoMark />
          <p className="lead" style={{ marginTop: 16 }}>
            Loading workspace…
          </p>
        </div>
      </div>
    );
  }

  if (!user || !company) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <LogoMark />
        <nav className="top-nav">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/roadmap">Roadmap</NavLink>
          <NavLink to="/data">Inventory</NavLink>
          <NavLink to="/simulator">Simulator</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="status-row">
          <span className="status-pill">
            <span className="dot green" />
            {company.name}
          </span>
          <span className="status-pill">
            <span className="dot amber" />
            {Math.round(company.reduction_pct * 100)}% by {company.target_year}
          </span>
          <span className="status-pill">
            <span className="dot orange" />
            {company.framework || "GHG Protocol"}
          </span>
          <button
            className="icon-btn"
            type="button"
            title="Export report"
            onClick={() => navigate("/")}
            aria-label="Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
          </button>
          <button className="icon-btn" type="button" title="Sign out" onClick={logout} aria-label="Menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
