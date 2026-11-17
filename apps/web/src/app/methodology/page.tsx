import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";

export const metadata = {
  title: "Methodology — Evidence-First Code Comprehension | TraceMigo",
  description:
    "Learn how the Predict → Trace → Explain pedagogical cycle builds verified mental models of complex code without uncontained execution.",
};

export default function MethodologyPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Methodology navigation">
          <Link className="text-link" href="/catalog">
            Explore catalog
          </Link>
          <Link className="text-link" href="/diagnostic">
            Diagnostic benchmark
          </Link>
        </nav>
      </header>

      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Pedagogical Framework</p>
          <h1>How TraceMigo Trains Code Comprehension</h1>
          <p>
            Most coding platforms ask you to write code from scratch. TraceMigo trains the prerequisite skill engineers spend 70% of their time on: reading, understanding, and diagnosing unfamiliar code.
          </p>
        </div>

        <section className="method-grid" aria-label="Learning steps">
          <article>
            <span className="step-number">01 / PREDICT</span>
            <h3>Commit Before Revealing</h3>
            <p>
              Formulate a falsifiable prediction before seeing the trace. Committing your reasoning creates cognitive dissonance when the execution diverges, accelerating learning.
            </p>
          </article>
          <article>
            <span className="step-number">02 / TRACE</span>
            <h3>Inspect Deterministic State</h3>
            <p>
              Step through verified, prerecorded execution traces. Inspect each state transition, loop pass, and clock boundary. No blind console guessing.
            </p>
          </article>
          <article>
            <span className="step-number">03 / EXPLAIN</span>
            <h3>Synthesize the Mechanism</h3>
            <p>
              Articulate the causal mechanism in your own words. Connect state preconditions to observed postconditions using precise technical vocabulary.
            </p>
          </article>
        </section>

        <section className="rubric-overview-section">
          <h2>The 6-Dimensional Comprehension Rubric</h2>
          <p>
            Comprehension is scored using deterministic evaluation rules and verified rubrics across six dimensions:
          </p>
          <ul>
            <li><strong>Mental Model (20%):</strong> Structural understanding of system states and invariant boundaries.</li>
            <li><strong>Execution Tracing (20%):</strong> Accurate step-by-step state following across loops, conditionals, and stack frames.</li>
            <li><strong>Bug Reasoning (25%):</strong> Identifying concurrency race conditions, off-by-one errors, and boundary oversights.</li>
            <li><strong>Complexity Justification (15%):</strong> Grounding asymptotic space and time analysis in operation counts.</li>
            <li><strong>Refactoring Invariance (10%):</strong> Restructuring code while preserving functional equivalence.</li>
            <li><strong>Technical Communication (10%):</strong> Clear, evidence-based prose without buzzwords or vague intuitions.</li>
          </ul>
        </section>

        <section className="case-cta-section">
          <h2>Experience the methodology</h2>
          <p>Start with a 5-minute finite warmup or test your skills on the diagnostic benchmark.</p>
          <div className="case-cta-actions">
            <Link href="/warmup/python/running-total" className="button">
              Try a Python warmup →
            </Link>
            <Link href="/diagnostic" className="button button-secondary">
              Take the diagnostic benchmark
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Scientific learning methodology · Deterministic scoring · Prerecorded execution.</p>
      </footer>
    </>
  );
}
