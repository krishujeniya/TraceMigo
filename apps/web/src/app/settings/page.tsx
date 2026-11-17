import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Account Settings & Privacy Controls | TraceMigo",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Settings navigation">
          <Link className="text-link" href="/history">
            Attempt history
          </Link>
          <Link className="text-link" href="/catalog">
            Catalog
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Account Governance</p>
          <h1>Settings & Privacy Controls</h1>
          <p>
            Manage profile preferences, consent declarations, data export requests, and self-service account deletion.
          </p>
        </div>

        <section className="settings-section">
          <h2>1. Data Portability</h2>
          <p>
            Download a machine-readable JSON archive containing all your predictions, traces, explanations, and scores.
          </p>
          <button type="button" className="button button-secondary">
            Request Data Export (.json)
          </button>
        </section>

        <section className="settings-section danger-zone">
          <h2>2. Self-Service Account Deletion</h2>
          <p>
            Permanently delete your TraceMigo account. Deletion tombstone records purge your personal data across database stores and subsequent backup restores.
          </p>
          <button type="button" className="button button-danger">
            Delete My Account & Data
          </button>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>User-controlled privacy · Instant export · Permanent deletion.</p>
      </footer>
    </>
  );
}
