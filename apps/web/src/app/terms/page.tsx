import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Terms of Service — Clear Boundaries and Fair Use | TraceMigo",
  description:
    "Plain-language terms of service. No false employment guarantees, no company affiliations, and honest service limits.",
};

export default function TermsPage() {
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
          <p className="eyebrow">Legal Boundaries</p>
          <h1>Terms of Service</h1>
          <p>
            Please read these terms carefully before using TraceMigo. We prioritize clear engineering expectations over convoluted legal jargon.
          </p>
        </div>

        <section className="legal-content">
          <h2>1. Purpose and Honest Guarantees</h2>
          <p>
            TraceMigo is an educational deliberate practice tool designed to train code comprehension.
            <strong> We make no guarantee of job placement, interview offers, salary increases, or specific test scores.</strong> We are an independent platform and are not affiliated with, endorsed by, or representing any tech employer or certification body.
          </p>

          <h2>2. Acceptable Use</h2>
          <p>You agree to use TraceMigo for lawful practice. You may not:</p>
          <ul>
            <li>Circumvent row-level security or access another learner&apos;s workspace.</li>
            <li>Scrape curriculum materials, answer keys, or evaluation rubrics using automated bots.</li>
            <li>Attempt to execute unauthorized or uncontained code on TraceMigo infrastructure.</li>
            <li>Share account credentials with multiple simultaneous users.</li>
          </ul>

          <h2>3. Intellectual Property</h2>
          <p>
            TraceMigo curriculum cases, rubric anchors, and software architecture are protected by copyright. Your original written explanations and reasoning submissions remain your intellectual property.
          </p>

          <h2>4. Cancellation and Refunds</h2>
          <p>
            Subscriptions can be cancelled at any time from your billing dashboard. We provide a full refund within 14 days of initial subscription purchase if you are unsatisfied with the curriculum.
          </p>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Honest service boundaries · Independent platform · No false outcome claims.</p>
      </footer>
    </>
  );
}
