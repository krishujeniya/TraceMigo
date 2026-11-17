import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup } from "@tracemigo/ui";

type CaseData = {
  title: string;
  summary: string;
  topic: string;
  difficulty: "F0" | "F1" | "F2" | "F3" | "F4";
  substantiveLines: number;
  filesCount: number;
  runtime: string;
  learningObjectives: string[];
  canonicalUrl: string;
};

const CASES: Record<string, CaseData> = {
  "token-bucket": {
    title: "Token Bucket Rate Limiter",
    summary:
      "State transitions, unsynchronized refill math, and clock boundaries in a multi-threaded rate limiter.",
    topic: "Concurrency & Clock State",
    difficulty: "F2",
    substantiveLines: 142,
    filesCount: 3,
    runtime: "Python 3.11+ / CPython standard library",
    learningObjectives: [
      "Trace token accumulation across non-uniform time intervals",
      "Identify the unsynchronized state transition between check and decrement",
      "Explain why the false missing-cap assertion fails against the bounded capacity specification",
      "Propose minimal atomic synchronization without deadlocking",
    ],
    canonicalUrl: "https://tracemigo.com/cases/python/token-bucket",
  },
};

export function generateStaticParams() {
  return [{ language: "python", slug: "token-bucket" }];
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ language: string; slug: string }>;
}): Promise<Metadata> {
  const { language, slug } = await params;
  const key = `${slug}`;
  const data = CASES[key];
  if (!data || language !== "python") {
    return { title: "Case Not Found | TraceMigo" };
  }

  return {
    title: `${data.title} — Python Comprehension Case | TraceMigo`,
    description: data.summary,
    alternates: {
      canonical: data.canonicalUrl,
    },
    openGraph: {
      title: data.title,
      description: data.summary,
      url: data.canonicalUrl,
      type: "article",
      siteName: "TraceMigo",
    },
  };
}

export default async function CaseOverviewPage({
  params,
}: {
  readonly params: Promise<{ language: string; slug: string }>;
}) {
  const { language, slug } = await params;
  const data = CASES[slug];
  if (!data || language !== "python") notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: data.title,
    description: data.summary,
    learningResourceType: "case study",
    educationalLevel: "Intermediate",
    inLanguage: "en",
    teaches: data.learningObjectives,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Case navigation">
          <Link className="text-link" href="/catalog">
            ← All exercises
          </Link>
          <Link className="button button-small" href={`/workspace/${slug}`}>
            Open in workspace <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </header>
      <main className="warmup-main" id="main-content">
        <div className="case-overview-header">
          <div className="card-top">
            <span className="tag">Python</span>
            <span className="small-note">
              Difficulty {data.difficulty} · {data.topic}
            </span>
          </div>
          <h1>{data.title}</h1>
          <p className="case-summary">{data.summary}</p>
        </div>

        <section className="case-spec-grid" aria-label="Case specifications">
          <article className="spec-card">
            <span className="eyebrow">Substantive Code</span>
            <strong>{data.substantiveLines} lines</strong>
            <p>Across {data.filesCount} source files with full type annotations.</p>
          </article>
          <article className="spec-card">
            <span className="eyebrow">Runtime Baseline</span>
            <strong>{data.runtime}</strong>
            <p>Deterministic execution model; no third-party network dependencies.</p>
          </article>
          <article className="spec-card">
            <span className="eyebrow">Pedagogical Flow</span>
            <strong>Predict → Trace → Explain</strong>
            <p>6-dimensional comprehension scoring with objective anchors.</p>
          </article>
        </section>

        <section className="case-learning-objectives" aria-labelledby="objectives-heading">
          <h2 id="objectives-heading">Key Comprehension Objectives</h2>
          <ul>
            {data.learningObjectives.map((obj) => (
              <li key={obj}>{obj}</li>
            ))}
          </ul>
        </section>

        <section className="case-cta-section">
          <h2>Ready to investigate this case?</h2>
          <p>
            Inspect the code in an interactive workspace, predict turning points, and evaluate hypotheses with prerecorded execution evidence.
          </p>
          <div className="case-cta-actions">
            <Link className="button" href={`/workspace/${slug}`}>
              Start Case in Workspace <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/warmup/python/running-total">
              Try a finite warmup first
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Canonical case overview · Prerecorded traces · No uncontained host code execution.</p>
      </footer>
    </>
  );
}
