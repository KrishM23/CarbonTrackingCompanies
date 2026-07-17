/** Right-side hero instrument: trajectory + scopes, soft motion only. */
export function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual-glow" />

      <svg className="hero-orbit" viewBox="0 0 320 320" fill="none">
        <circle className="hero-orbit-ring r1" cx="160" cy="160" r="118" />
        <circle className="hero-orbit-ring r2" cx="160" cy="160" r="92" />
        <circle className="hero-orbit-ring r3" cx="160" cy="160" r="66" />
        <circle className="hero-orbit-dot d1" cx="160" cy="42" r="3.5" />
        <circle className="hero-orbit-dot d2" cx="252" cy="160" r="2.5" />
        <circle className="hero-orbit-dot d3" cx="160" cy="226" r="3" />
      </svg>

      <div className="hero-instrument">
        <div className="hero-instrument-head">
          <span>Company path</span>
          <span className="hero-instrument-tag">vs target</span>
        </div>

        <svg className="hero-chart" viewBox="0 0 360 160" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(61,214,140,0.28)" />
              <stop offset="100%" stopColor="rgba(61,214,140,0)" />
            </linearGradient>
          </defs>
          <path
            className="hero-chart-grid"
            d="M0 40H360M0 80H360M0 120H360"
          />
          <path
            className="hero-chart-area"
            d="M8 118 C 60 112, 90 98, 130 88 C 170 78, 200 70, 240 52 C 280 34, 310 28, 352 22 L352 160 L8 160 Z"
            fill="url(#heroFill)"
          />
          <path
            className="hero-chart-target"
            d="M8 108 C 70 100, 140 86, 210 64 C 270 46, 320 36, 352 30"
          />
          <path
            className="hero-chart-line"
            d="M8 118 C 60 112, 90 98, 130 88 C 170 78, 200 70, 240 52 C 280 34, 310 28, 352 22"
          />
        </svg>

        <div className="hero-scope-meters">
          <div className="hero-scope-meter">
            <div className="hero-scope-meta">
              <span>Scope 1</span>
              <span>Fuel</span>
            </div>
            <div className="hero-scope-track">
              <i className="s1" style={{ width: "42%" }} />
            </div>
          </div>
          <div className="hero-scope-meter">
            <div className="hero-scope-meta">
              <span>Scope 2</span>
              <span>Power</span>
            </div>
            <div className="hero-scope-track">
              <i className="s2" style={{ width: "28%" }} />
            </div>
          </div>
          <div className="hero-scope-meter">
            <div className="hero-scope-meta">
              <span>Scope 3</span>
              <span>Value chain</span>
            </div>
            <div className="hero-scope-track">
              <i className="s3" style={{ width: "68%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
