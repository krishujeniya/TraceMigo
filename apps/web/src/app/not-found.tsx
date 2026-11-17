import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export default function NotFound() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <Link className="text-link" href="/">
          ← Back to home
        </Link>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="empty-state-card" role="region" aria-label="Page not found">
          <p className="eyebrow">404 Error</p>
          <h1>Page Not Found</h1>
          <p>
            The route you requested does not exist or may have been relocated.
          </p>
          <div className="error-actions">
            <Link href="/" className="button">
              Return to home
            </Link>
            <Link href="/catalog" className="button button-secondary">
              Browse warmup catalog
            </Link>
          </div>
        </div>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Canonical routes · No reflected path input.</p>
      </footer>
    </>
  );
}
