import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Interactive Workspace | TraceMigo",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage({
  params,
}: {
  readonly params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Workspace navigation">
          <Link className="text-link" href="/history">
            Attempt history
          </Link>
          <Link className="text-link" href="/catalog">
            Catalog
          </Link>
          <Link className="button button-small button-secondary" href="/settings">
            Settings
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <div className="card-top">
            <span className="tag">Active Workspace</span>
            <span className="small-note">Attempt: <code>{attemptId}</code></span>
          </div>
          <h1>Investigation Workspace</h1>
          <p>
            Interactive practice session: read the multi-file source, form predictions, step through execution traces, and submit reasoned explanations.
          </p>
        </div>

        <div className="workspace-placeholder-card">
          <p className="eyebrow">Interactive Session Ready</p>
          <h2>Token Bucket Investigation Session</h2>
          <p>
            Full workspace controls and stage transitions (Predict → Trace → Explain → Refactor) are managed under Phase 3 learning stage contracts.
          </p>
          <div className="workspace-meta">
            <span>Stage: <strong>Prediction</strong></span>
            <span>Revision: <strong>1</strong></span>
            <span>Autosave: <strong>Active</strong></span>
          </div>
        </div>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo Workspace · Attempt {attemptId}</span>
        <p>Authenticated session · Isolated workspace · RLS protected.</p>
      </footer>
    </>
  );
}
