import { Link } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";

export function ContactPage() {
  return (
    <div className="contact-page">
      <header className="landing-top">
        <Link to="/login" className="logo-btn brand-home" aria-label="Vapor home">
          <BrandLogo size="sm" withWordmark />
        </Link>
        <div className="landing-top-actions">
          <Link className="landing-link" to="/login">
            Product
          </Link>
          <Link className="btn btn-secondary landing-top-btn" to="/login#signin">
            Sign in
          </Link>
        </div>
      </header>

      <main className="contact-main">
        <div className="contact-copy">
          <p className="contact-eyebrow">Contact</p>
          <h1>Meet Vapor&apos;s founder</h1>
          <p className="contact-lead">
            Questions about a pilot, a demo for your company, or how Scope 1, 2, and 3 fit your
            reporting? Reach out directly.
          </p>

          <a className="contact-email" href="mailto:vapor.emissions@gmail.com">
            vapor.emissions@gmail.com
          </a>

          <div className="contact-actions">
            <a className="btn btn-primary" href="mailto:vapor.emissions@gmail.com">
              Send an email
            </a>
            <Link className="btn btn-secondary" to="/login">
              Back to Vapor
            </Link>
          </div>
        </div>

        <aside className="contact-founder">
          <img
            className="contact-photo"
            src="/krish-matai.png"
            alt="Krish Matai, founder of Vapor"
            width={320}
            height={320}
          />
          <div className="contact-founder-meta">
            <h2>Krish Matai</h2>
            <p className="contact-role">Founder</p>
            <p className="contact-bio">
              UCLA Statistics &amp; Data Science sophomore. Building Vapor to help mid-size companies
              see their emissions clearly and act on them.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
