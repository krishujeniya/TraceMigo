import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Admin Appeals Queue | TraceMigo",
  robots: { index: false, follow: false },
};

export default function AdminAppealsPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Admin navigation">
          <Link className="text-link" href="/admin/catalog">
            Curriculum gate
          </Link>
          <Link className="text-link" href="/catalog">
            Public catalog
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Admin Authority</p>
          <h1>Scoring Appeals & Dispute Review</h1>
          <p>
            Independent review queue for contested rubrics, alternative correct hypotheses, and score corrections.
          </p>
        </div>

        <section className="admin-status-card">
          <h2>Appeals Queue Status</h2>
          <p>Zero pending learner score disputes in queue.</p>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo Admin · Authority Gate</span>
        <p>Restricted admin role · Authenticated session required.</p>
      </footer>
    </>
  );
}
