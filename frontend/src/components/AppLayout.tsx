import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { BrandLogo } from "./BrandLogo";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/data", label: "Inventory" },
  { to: "/simulator", label: "Simulator" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppLayout() {
  const { user, company, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setNotesOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!company) return;
    document.title = `${company.name} · Vapor`;
  }, [company]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (notesOpen && notesRef.current && !notesRef.current.contains(t)) setNotesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notesOpen]);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <BrandLogo size="lg" withWordmark />
          <p className="lead" style={{ marginTop: 16 }}>
            Loading {company?.name || "workspace"}…
          </p>
        </div>
      </div>
    );
  }

  if (!user || !company) {
    return <Navigate to="/login" replace />;
  }

  const exportPdf = async () => {
    setPdfBusy(true);
    setMenuOpen(false);
    try {
      await api.downloadPdf();
      setToast(`${company.name} board PDF downloaded`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setPdfBusy(false);
      setTimeout(() => setToast(""), 3200);
    }
  };

  const notifications = [
    {
      id: "1",
      title: `${company.name} inventory`,
      body: "Confirm the latest Scope 1, 2, and 3 figures before board export or customer questionnaires.",
      tone: "green" as const,
      action: () => navigate("/data"),
    },
    {
      id: "2",
      title: `${Math.round(company.reduction_pct * 100)}% by ${company.target_year}`,
      body: "Stress-test electrification and clean-power levers against your commitment.",
      tone: "amber" as const,
      action: () => navigate("/simulator"),
    },
    {
      id: "3",
      title: company.framework || "Disclosure readiness",
      body: "Review GHG / SBTi checklist items tailored to your company profile.",
      tone: "orange" as const,
      action: () => navigate("/roadmap"),
    },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="logo-btn brand-home"
          onClick={() => navigate("/")}
          aria-label="Vapor home"
        >
          <BrandLogo size="sm" withWordmark />
        </button>

        <nav className="top-nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={"end" in item ? item.end : false}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="status-row">
          <span className="status-pill hide-sm">
            <span className="dot green" />
            {company.name}
          </span>
          <span className="status-pill hide-md">
            <span className="dot amber" />
            {Math.round(company.reduction_pct * 100)}% by {company.target_year}
          </span>
          <span className="status-pill hide-lg">
            <span className="dot orange" />
            {company.framework || "GHG Protocol"}
          </span>

          <div className="menu-anchor" ref={notesRef}>
            <button
              className={`icon-btn ${notesOpen ? "active" : ""}`}
              type="button"
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={notesOpen}
              aria-haspopup="true"
              onClick={() => {
                setNotesOpen((v) => !v);
                setMenuOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              <span className="badge-dot" />
            </button>
            {notesOpen && (
              <div className="dropdown panel-menu" role="menu">
                <div className="dropdown-head">For {company.name}</div>
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="dropdown-item note-item"
                    role="menuitem"
                    onClick={() => {
                      n.action();
                      setNotesOpen(false);
                    }}
                  >
                    <span className={`dot ${n.tone}`} />
                    <span>
                      <strong>{n.title}</strong>
                      <small>{n.body}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="menu-anchor" ref={menuRef}>
            <button
              className={`icon-btn ${menuOpen ? "active" : ""}`}
              type="button"
              title="Menu"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => {
                setMenuOpen((v) => !v);
                setNotesOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
            {menuOpen && (
              <div className="dropdown panel-menu" role="menu">
                <div className="dropdown-head">
                  <div className="who">{user.full_name || company.name}</div>
                  <small>
                    {user.email} · {company.name}
                  </small>
                </div>
                <div className="dropdown-section">Workspace</div>
                {NAV.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      navigate(item.to);
                      setMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="dropdown-section">Actions</div>
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  disabled={pdfBusy}
                  onClick={exportPdf}
                >
                  {pdfBusy ? "Preparing PDF…" : `Export ${company.name} PDF`}
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    navigate("/settings");
                    setMenuOpen(false);
                  }}
                >
                  Company & target
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    navigate("/contact");
                    setMenuOpen(false);
                  }}
                >
                  Contact
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate("/login");
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Mobile">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={"end" in item ? item.end : false}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="main">
        <Outlet />
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
