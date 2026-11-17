import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Admin Curriculum Gate | TraceMigo",
  robots: { index: false, follow: false },
};

export default function AdminCatalogPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Admin navigation">
          <Link className="text-link" href="/admin/appeals">
            Appeals queue
          </Link>
          <Link className="text-link" href="/catalog">
            Public catalog
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Admin Authority</p>
          <h1>Curriculum Publication Gate</h1>
          <p>
            Two-review consensus verification, license provenance checks, and immutable artifact hashing.
          </p>
        </div>

        <section className="admin-status-card">
          <h2>Immutable Publication Invariants</h2>
          <ul>
            <li>Draft versions require at least two distinct peer review approvals.</li>
            <li>Sealed assessment cases are strictly quarantined from public catalog projections.</li>
            <li>Published problem records cannot be mutated in place; version retirement required.</li>
          </ul>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo Admin · Authority Gate</span>
        <p>Restricted admin role · Authenticated session required.</p>
      </footer>
    </>
  );
}
