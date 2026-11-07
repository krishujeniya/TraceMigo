"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Example } from "../warmup/python/examples";
import { readProgress, type Progress } from "../warmup/python/progress";

export function Library({ examples }: { readonly examples: Example[] }) {
  const [saved, setSaved] = useState<Record<string, Progress>>({});
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    const progress: Record<string, Progress> = {};
    try {
      for (const example of examples) {
        const raw = sessionStorage.getItem(`tracemigo:warmup:${example.id}:v1`);
        if (!raw) continue;
        try { const value = readProgress(JSON.parse(raw), example); if (value?.prediction) progress[example.id] = value; }
        catch { /* Ignore malformed saved data for this example. */ }
      }
    } catch { setStorageAvailable(false); }
    setSaved(progress);
  }, [examples]);
  return <><p className="library-storage" role="status">{storageAvailable ? "Your place is saved separately for each warmup, in this tab only." : "Tab storage is unavailable. You can still practice, but progress will not survive navigation."}</p><div className="library-grid">{examples.map(example => {
    const progress = saved[example.id];
    return <Link key={example.id} className="practice-card" href={`/warmup/python/${example.id}`} data-exercise={example.id}><div className="card-top"><span className="tag">Python</span><span className="small-note">{example.topic}</span></div><h2>{example.title} <span aria-hidden="true">↗</span></h2><p>{example.description}</p><p className="exercise-status">{progress ? `Your place: ${["Prediction", "Trace", "Explanation"][progress.stage]}` : "Ready when you are"}</p><div className="card-bottom"><span>{example.code.length} lines · Introductory</span><strong>{progress ? "Continue warmup →" : "Begin warmup →"}</strong></div></Link>;
  })}</div></>;
}
