import Link from "next/link";
import { BrandLockup } from "@tracemigo/ui";
import { Warmup } from "./warmup";
import { runningTotal } from "../examples";

export default function WarmupPage() {
  return <><header className="site-header"><Link href="/" aria-label="TraceMigo home"><BrandLockup /></Link><Link className="text-link" href="/catalog">← All warmups</Link></header><main className="warmup-main" id="main-content"><div className="warmup-heading"><p className="eyebrow">Python / Introductory warmup</p><h1>Follow the running total.</h1><p>Read the code, predict the output, then check your reasoning against a prerecorded trace.</p></div><Warmup key={runningTotal.id} example={runningTotal} /></main><footer className="site-footer page-width"><span>One example. A good place to stop.</span><p>No code is executed. This public example and its trace are included in the page.</p></footer></>;
}
