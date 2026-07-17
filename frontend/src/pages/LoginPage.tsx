import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { HeroVisual } from "../components/HeroVisual";
import { Reveal } from "../components/Reveal";
import { VaporField } from "../components/VaporField";
import { VaporTitle } from "../components/VaporTitle";

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

  const fillDemo = () => {
    setEmail("demo@acme.corp");
    setPassword("demo1234");
    document.getElementById("signin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing">
      <div className="landing-mist" aria-hidden />
      <div className="landing-vapor-stage" aria-hidden>
        <VaporField density={30} />
      </div>

      <header className="landing-top">
        <BrandLogo size="sm" withWordmark />
        <div className="landing-top-actions">
          <a className="landing-link" href="#scopes">
            What we measure
          </a>
          <a className="landing-link" href="#how">
            How it works
          </a>
          <Link className="landing-link" to="/contact">
            Contact
          </Link>
          <a className="btn btn-secondary landing-top-btn" href="#signin">
            Sign in
          </a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <VaporTitle text="Vapor" className="landing-brand" />
          <p className="landing-headline hero-line" style={{ animationDelay: "0.4s" }}>
            See where your carbon comes from, and whether your goal is realistic.
          </p>
          <p className="landing-lead hero-line" style={{ animationDelay: "0.55s" }}>
            Most teams only see a spreadsheet once a year. Vapor turns those numbers into a clear path
            forward: what you emitted, what you promised, and what has to change.
          </p>
          <div className="landing-cta hero-line" style={{ animationDelay: "0.7s" }}>
            <a className="btn btn-primary" href="#signin">
              Open your workspace
            </a>
            <button className="btn btn-secondary" type="button" onClick={fillDemo}>
              Peek at the Acme demo
            </button>
          </div>
        </div>
        <div className="landing-hero-visual hero-line" style={{ animationDelay: "0.5s" }}>
          <HeroVisual />
        </div>
      </section>

      <section className="landing-scopes" id="scopes">
        <Reveal>
          <h2>First, plain English</h2>
          <p className="landing-scopes-intro">
            <strong>Emissions</strong> are the greenhouse gases your business puts into the air,
            mostly carbon dioxide. People count them in tonnes (t CO₂e). Buyers, banks, and boards ask
            for them because they show how hard your operations hit the climate.
          </p>
          <p className="landing-scopes-intro">
            Climate reporting splits those tonnes into three buckets called scopes, so everyone talks
            about the same thing.
          </p>
        </Reveal>

        <div className="scope-explain">
          <Reveal delayMs={40}>
            <article className="scope-explain-row s1">
              <div className="scope-explain-num">1</div>
              <div>
                <h3>Scope 1 · Fuel you burn yourself</h3>
                <p>
                  Gas boilers, company trucks, forklifts, on-site generators. If your people lit the
                  flame or turned the key, it lands here.
                </p>
              </div>
            </article>
          </Reveal>
          <Reveal delayMs={80}>
            <article className="scope-explain-row s2">
              <div className="scope-explain-num">2</div>
              <div>
                <h3>Scope 2 · Power you buy</h3>
                <p>
                  Electricity and heat from the grid. You did not burn the fuel at the plant, but your
                  buildings and machines still caused it.
                </p>
              </div>
            </article>
          </Reveal>
          <Reveal delayMs={120}>
            <article className="scope-explain-row s3">
              <div className="scope-explain-num">3</div>
              <div>
                <h3>Scope 3 · Everyone you rely on</h3>
                <p>
                  Suppliers, shipping, business flights, waste, and how customers use what you sell.
                  Often the biggest number, and the hardest to pin down.
                </p>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="landing-how" id="how">
        <Reveal>
          <h2>How it works</h2>
          <p className="landing-scopes-intro">
            Three steps. No jargon required.
          </p>
        </Reveal>
        <div className="how-steps">
          <Reveal delayMs={40}>
            <article className="how-step">
              <div className="how-step-num">1</div>
              <h3>Enter your yearly numbers</h3>
              <p>
                Add what your company emitted each year for Scope 1, 2, and 3, or upload a simple CSV.
                That becomes your inventory.
              </p>
            </article>
          </Reveal>
          <Reveal delayMs={90}>
            <article className="how-step">
              <div className="how-step-num">2</div>
              <h3>See if you are on track</h3>
              <p>
                Set a reduction goal (for example, cut 50% by 2035). Vapor forecasts your path and
                shows whether you are likely to hit it.
              </p>
            </article>
          </Reveal>
          <Reveal delayMs={140}>
            <article className="how-step">
              <div className="how-step-num">3</div>
              <h3>Try changes, then share</h3>
              <p>
                Test ideas like cleaner power or less travel. Save the options that work, and export a
                PDF your board or customers can read.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="landing-signin" id="signin">
        <Reveal>
          <div className="landing-signin-copy">
            <h2>Ready when you are</h2>
            <p>
              Sign in to your company workspace, or try the Acme Manufacturing demo to see forecasts,
              what-if levers, and a board PDF with real sample data.
            </p>
          </div>
        </Reveal>
        <Reveal delayMs={60}>
          <form className="landing-form" onSubmit={onSubmit}>
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
            <button className="btn btn-secondary" type="button" onClick={fillDemo}>
              Use demo account
            </button>
            <p className="switch">
              New here? <Link to="/signup">Create a company workspace</Link>
            </p>
          </form>
        </Reveal>
      </section>

      <footer className="landing-foot">
        <span>Vapor</span>
        <span>
          One company per workspace.{" "}
          <Link to="/contact">Contact</Link>
        </span>
      </footer>
    </div>
  );
}
