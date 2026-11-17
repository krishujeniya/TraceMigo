import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Pricing — Transparent Learning Tiers | TraceMigo",
  description:
    "Honest pricing with no hidden subscription traps. Free finite warmups, comprehensive practice tiers, and clear refund guarantees.",
};

export default function PricingPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Pricing navigation">
          <Link className="text-link" href="/catalog">
            View catalog
          </Link>
          <Link className="text-link" href="/diagnostic">
            Diagnostic benchmark
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Fair Pricing</p>
          <h1>Transparent practice tiers</h1>
          <p>
            No recurring subscription traps, artificial engagement streaks, or hidden limits. Clear, predictable access for engineers committed to deep practice.
          </p>
        </div>

        <div className="pricing-grid">
          <article className="pricing-card">
            <span className="tag">Free Preview</span>
            <h2>Anonymous Warmups</h2>
            <p className="pricing-cost"><strong>$0</strong></p>
            <p>Perfect for testing the Predict → Trace → Explain methodology.</p>
            <ul className="pricing-features">
              <li>3 finite anonymous warmups</li>
              <li>Prerecorded step-by-step traces</li>
              <li>Local tab reasoning notes</li>
              <li>Full access to case overviews</li>
            </ul>
            <Link className="button button-secondary" href="/catalog">
              Start Free Warmups →
            </Link>
          </article>

          <article className="pricing-card featured-tier">
            <span className="tag">Pro Practice</span>
            <h2>Full Curriculum</h2>
            <p className="pricing-cost"><strong>$19</strong> <span>/ month</span></p>
            <p>Comprehensive code-reading mastery for practicing software engineers.</p>
            <ul className="pricing-features">
              <li>All 30 reviewed Python cases</li>
              <li>Calibrated 25-minute diagnostic benchmark</li>
              <li>Spaced-retrieval review scheduler</li>
              <li>Detailed 6-dimensional rubric evaluation</li>
              <li>Consented data export & self-service deletion</li>
            </ul>
            <Link className="button" href="/register">
              Create Account →
            </Link>
          </article>
        </div>

        <section className="pricing-guarantees">
          <h2>Our Commitments</h2>
          <div className="guarantees-grid">
            <article>
              <h3>No Dark Patterns</h3>
              <p>Cancel your subscription in one click from your billing page. No phone calls, guilt surveys, or hidden retention gates.</p>
            </article>
            <article>
              <h3>14-Day Refund Guarantee</h3>
              <p>If TraceMigo does not improve your code reading within two weeks, request a full refund directly through your account.</p>
            </article>
            <article>
              <h3>Data Portability</h3>
              <p>Export all your predictions, traces, explanations, and scores in structured JSON format anytime.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Transparent pricing · 14-day refund policy · No dark patterns.</p>
      </footer>
    </>
  );
}
