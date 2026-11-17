import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Billing & Subscriptions | TraceMigo",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Billing navigation">
          <Link className="text-link" href="/settings">
            Settings
          </Link>
          <Link className="text-link" href="/catalog">
            Catalog
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Financial Ledger</p>
          <h1>Billing & Subscription Management</h1>
          <p>
            View current entitlement tier, download past invoices, and manage payment methods without dark patterns.
          </p>
        </div>

        <section className="billing-card">
          <div className="card-top">
            <span className="tag">Active Tier</span>
            <span className="small-note">Renewal: Monthly</span>
          </div>
          <h2>Pro Practice Tier</h2>
          <p>Full access to all 30 curriculum cases, 25-minute diagnostics, and rubric evaluations.</p>
          <div className="billing-actions">
            <button type="button" className="button button-secondary">
              Update Payment Method
            </button>
            <button type="button" className="button button-secondary">
              Cancel Subscription
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>14-day refund guarantee · Instant cancellation · No phone calls or retention tricks.</p>
      </footer>
    </>
  );
}
