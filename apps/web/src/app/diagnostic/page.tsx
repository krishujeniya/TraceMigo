import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Diagnostic Benchmark — 25-Minute Comprehension Baseline | TraceMigo",
  description:
    "Calibrate your Python code-reading skills across 6 core rubric dimensions with a single 25-minute multi-file case study.",
};

const RUBRIC_DIMENSIONS = [
  { name: "Mental Model", weight: "20%", description: "Constructing an accurate internal representation of state machines and data flow." },
  { name: "Trace Precision", weight: "20%", description: "Accurately following step-by-step variable mutations and conditional jumps without guessing." },
  { name: "Bug Reasoning", weight: "25%", description: "Isolating subtle state concurrency races and boundary violations with evidence." },
  { name: "Complexity Justification", weight: "15%", description: "Deriving time and space asymptotic bounds with rigorous operation counting." },
  { name: "Refactoring Invariance", weight: "10%", description: "Modifying code structure while proving external behavior remains preserved." },
  { name: "Technical Communication", weight: "10%", description: "Explaining causal mechanisms concisely using precise engineering vocabulary." },
];

export default function DiagnosticPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Diagnostic navigation">
          <Link className="text-link" href="/catalog">
            ← Warmups & Catalog
          </Link>
        </nav>
      </header>
      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Calibrated Assessment</p>
          <h1>The 25-Minute Diagnostic Benchmark</h1>
          <p>
            An objective baseline to measure where your code reading is sharp and where your mental model drifts. One realistic Python system case. No trick questions.
          </p>
        </div>

        <section className="diagnostic-summary-grid" aria-label="Diagnostic properties">
          <article className="spec-card">
            <span className="eyebrow">Duration</span>
            <strong>25 Minutes</strong>
            <p>Timed practice with optional untimed accessibility mode.</p>
          </article>
          <article className="spec-card">
            <span className="eyebrow">Structure</span>
            <strong>1 Production Case</strong>
            <p>Multi-file token bucket implementation with concurrency nuances.</p>
          </article>
          <article className="spec-card">
            <span className="eyebrow">Outcome</span>
            <strong>Diagnostic Report</strong>
            <p>Detailed breakdown across 6 rubric dimensions with tailored case recommendations.</p>
          </article>
        </section>

        <section className="diagnostic-rubric-section" aria-labelledby="rubric-heading">
          <h2 id="rubric-heading">How Your Reading Is Evaluated</h2>
          <p>
            Scoring is determined by deterministic evaluation rules and verified rubrics, not subjective impressions:
          </p>
          <div className="rubric-grid">
            {RUBRIC_DIMENSIONS.map((dim) => (
              <div key={dim.name} className="rubric-item">
                <div className="card-top">
                  <h3>{dim.name}</h3>
                  <span className="tag">{dim.weight}</span>
                </div>
                <p>{dim.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="diagnostic-start-card">
          <h2>Start your diagnostic attempt</h2>
          <p>
            You will inspect the code, predict execution behavior, trace state across critical steps, and explain key turning points.
          </p>
          <div className="diagnostic-actions">
            <Link className="button" href="/workspace/diagnostic">
              Begin Diagnostic Benchmark <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/warmup/python/running-total">
              Try a short warmup first
            </Link>
          </div>
          <p className="small-note">
            Saved diagnostic results require an authenticated account. If you are not signed in, you can start the session and register when saving your evaluation.
          </p>
        </section>
      </main>
      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Calibrated diagnostic baseline · Objective rubrics · No shared or public score boards.</p>
      </footer>
    </>
  );
}
