import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup } from "@tracemigo/ui";
import { allExamples } from "../../warmup/python/examples";
import { Library } from "../library";

export function generateStaticParams() {
  return [{ language: "python" }];
}

export default async function LanguageCatalogPage({
  params,
}: {
  readonly params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  if (language.toLowerCase() !== "python") {
    notFound();
  }

  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <nav aria-label="Catalog navigation">
          <Link className="text-link" href="/catalog">
            All tracks
          </Link>
          <Link className="text-link" href="/diagnostic">
            Diagnostic benchmark
          </Link>
        </nav>
      </header>
      <main className="warmup-main library-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Language Track · Python</p>
          <h1>Python Code Comprehension</h1>
          <p>
            Prerecorded execution traces and decision-point reasoning for Python engineers. 3 finite warmups, 6 foundation cases, and 18 core problems.
          </p>
        </div>
        <Library examples={[...allExamples]} />
      </main>
      <footer className="site-footer page-width">
        <span>TraceMigo / Read code. Think together.</span>
        <p>Tab-local progress · No live execution or uncontained scripts.</p>
      </footer>
    </>
  );
}
