import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Privacy Policy — Purpose-Specific Data Retention | TraceMigo",
  description:
    "Transparent data inventory, purpose-specific consent, zero raw code in analytics, and verifiable self-service deletion.",
};

export default function PrivacyPage() {
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
        <div className="warmup-heading">
          <p className="eyebrow">Data Governance</p>
          <h1>Privacy Policy</h1>
          <p>
            TraceMigo respects learner privacy. We do not sell your personal data, track you across the web, or train public AI models on your private explanations.
          </p>
        </div>

        <section className="legal-content">
          <h2>1. Data Inventory and Purposes</h2>
          <p>We collect and process personal data strictly to deliver the learning service:</p>
          <ul>
            <li><strong>Identity:</strong> Email address and verified OIDC sub identifier to manage your account.</li>
            <li><strong>Learning Evidence:</strong> Predictions, trace steps, written explanations, and diagnostic submissions to score attempts and schedule spaced retrieval.</li>
            <li><strong>Session Cookies:</strong> Encrypted, HTTP-only session tokens to maintain authorized workspace access.</li>
          </ul>

          <h2>2. Strict Privacy Protections</h2>
          <ul>
            <li><strong>Zero Raw Code or Answers in Analytics:</strong> Our operational telemetry records event types and counts only. We never forward learner code or answers to analytics sinks.</li>
            <li><strong>Prerecorded Execution:</strong> We run only verified, prerecorded traces. Your browser never executes untrusted code on our servers.</li>
            <li><strong>Model Privacy:</strong> If peer evaluation models are used, your data is processed through enterprise endpoints with contractual zero-data-retention guarantees.</li>
          </ul>

          <h2>3. Data Retention Windows</h2>
          <ul>
            <li><strong>Interactive Transcripts:</strong> Retained for 30 days before automated purging.</li>
            <li><strong>Trace State:</strong> Retained for 7 days after attempt finalization.</li>
            <li><strong>Aggregated Operational Events:</strong> Retained for 90 days.</li>
          </ul>

          <h2>4. Your Rights: Export and Deletion</h2>
          <p>
            You retain complete ownership of your learning data. Through your <Link href="/settings">Account Settings</Link>, you can:
          </p>
          <ul>
            <li>Request a full machine-readable JSON export of all your attempts and rubrics.</li>
            <li>Trigger self-service account deletion, which propagates tombstones across operational databases and backup restoration replays.</li>
          </ul>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Purpose-specific privacy · 30-day retention ceiling · Verifiable deletion.</p>
      </footer>
    </>
  );
}
