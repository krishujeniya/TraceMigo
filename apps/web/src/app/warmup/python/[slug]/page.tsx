import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup } from "@tracemigo/ui";
import { Warmup } from "../running-total/warmup";
import { getExampleById, allExamples } from "../examples";

export function generateStaticParams() {
  return allExamples.map((ex) => ({ slug: ex.id }));
}

export default async function DynamicWarmupPage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const example = getExampleById(slug);
  if (!example) notFound();

  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="TraceMigo home">
          <BrandLockup />
        </Link>
        <Link className="text-link" href="/catalog">
          ← All warmups
        </Link>
      </header>
      <main className="warmup-main" id="main-content">
        <div className="warmup-heading">
          <p className="eyebrow">Python / Introductory warmup</p>
          <h1>{example.title}.</h1>
          <p>
            Read the code, predict the output, then check your reasoning against a prerecorded trace.
          </p>
        </div>
        <Warmup key={example.id} example={example} />
      </main>
      <footer className="site-footer page-width">
        <span>One example. A good place to stop.</span>
        <p>No code is executed. This public example and its trace are included in the page.</p>
      </footer>
    </>
  );
}
