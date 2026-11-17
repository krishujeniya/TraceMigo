"use client";

import Link from "next/link";

export default function CatalogError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="warmup-main library-main" role="alert">
      <div className="error-card">
        <p className="eyebrow">Unable to load catalog</p>
        <h2>Something interrupted the catalog view</h2>
        <p>An unexpected client error occurred while loading exercises.</p>
        <div className="error-actions">
          <button type="button" className="button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="text-link">
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
