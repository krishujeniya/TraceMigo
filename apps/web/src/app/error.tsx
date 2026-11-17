"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="warmup-main" role="alert">
      <div className="error-card">
        <p className="eyebrow">Application Error</p>
        <h1>An unexpected error occurred</h1>
        <p>
          We encountered an issue while processing your request. Your local progress has been preserved.
        </p>
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
