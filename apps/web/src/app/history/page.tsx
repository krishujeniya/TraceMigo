import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Attempt History & Diagnostic Reports | TraceMigo",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="History navigation">
          <Link className="text-link" href="/catalog">
            Catalog
          </Link>
          <Link className="text-link" href="/settings">
            Settings
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Learner Profile</p>
          <h1>Attempt History & Spaced Retrieval</h1>
          <p>
            Review past case investigations, diagnostic evaluations, and scheduled retrieval review sessions.
          </p>
        </div>

        <section className="history-empty-card">
          <p className="eyebrow">Zero Past Attempts</p>
          <h2>No completed case attempts yet</h2>
          <p>
            Complete your first case or take the calibrated 25-minute diagnostic to generate your comprehension profile.
          </p>
          <div className="history-actions">
            <Link className="button" href="/diagnostic">
              Start Diagnostic Benchmark →
            </Link>
            <Link className="button button-secondary" href="/catalog">
              Browse Practice Cases
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Private learner history · Indexed only for your authenticated session.</p>
      </footer>
    </>
  );
}
