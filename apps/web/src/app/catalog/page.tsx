import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";
import { allExamples } from "../warmup/python/examples";
import { Library } from "./library";

export const metadata = {
  title: "Catalog — Python Comprehension Exercises | TraceMigo",
  description:
    "Explore Python comprehension warmups, foundation cases, and core engineering problems. Read code, predict state transitions, and explain mechanisms.",
};

export default function CatalogPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Catalog navigation">
          <Link className="text-link" href="/diagnostic">
            Diagnostic benchmark
          </Link>
          <Link className="text-link" href="/">
            ← Back to home
          </Link>
        </nav>
      </header>
      <main className="warmup-main library-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">The warmup library</p>
          <h1>Small code. Clearer thinking.</h1>
          <p>
            Choose one Python example. Make a prediction, inspect the prerecorded trace, then explain what changed.
          </p>
        </div>
        <Library examples={[...allExamples]} />
        <aside className="library-note">
          <h2>A short practice session is enough.</h2>
          <p>
            These public exercises are a local preview, not an assessment or full course. Work through one, try the other, or stop when you need to. No account, timer or streak to maintain.
          </p>
        </aside>
      </main>
      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Tab-local progress · No live execution, AI assistance or graded mastery.</p>
      </footer>
    </>
  );
}
