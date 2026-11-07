"use client";

import { useEffect, useRef, useState } from "react";

import type { Example } from "../examples";

import { INITIAL, readProgress, type Progress } from "../progress";

const STEPS = ["Predict", "Trace", "Explain"];

export function Warmup({ example }: { readonly example: Example }) {
  const key = `tracemigo:warmup:${example.id}:v1`;
  const lastStep = example.trace.length - 1;
  const [progress, setProgress] = useState<Progress>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        try { const restored = readProgress(JSON.parse(saved), example); if (restored) setProgress(restored); }
        catch { /* Invalid saved data starts a fresh example. */ }
      }
    } catch { setStorageAvailable(false); }
    setLoaded(true);
  }, [key, example]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(key, JSON.stringify(progress)); }
    catch { setStorageAvailable(false); }
  }, [loaded, progress, key]);
  function move(stage: number) {
    setProgress(p => ({ ...p, stage }));
    requestAnimationFrame(() => heading.current?.focus());
  }
  function reset() {
    setProgress({ ...INITIAL });
    requestAnimationFrame(() => heading.current?.focus());
  }
  const current = example.trace[progress.trace]!;
  return <div className="warmup">
    <div className="progress-bar"><ol aria-label="Warmup steps">{STEPS.map((name, index) => <li key={name} aria-current={progress.stage === index ? "step" : undefined}><span>{index + 1}</span>{name}</li>)}</ol><span className="save-note" role="status">{!loaded ? "Opening warmup…" : storageAvailable ? "Saved in this tab" : "Progress is temporary · tab storage unavailable"}</span></div>
    <div className="workspace-grid"><section className="source-panel" aria-label="Python source"><div className="source-title"><span>{example.filename}</span><span>Python</span></div><pre><code>{example.code.map((line, index) => <span key={line} className={`source-line${progress.stage > 0 && current.line === index + 1 ? " highlighted" : ""}`}><span className="line-number" aria-hidden="true">{index + 1}</span>{line}</span>)}</code></pre><p className="source-note">Fixed example · prerecorded trace · no live execution</p></section>
    <section className="question-panel" aria-labelledby="step-heading"><p className="eyebrow">Step {progress.stage + 1} of 3</p><h2 id="step-heading" ref={heading} tabIndex={-1}>{progress.stage === 0 ? "What gets printed?" : progress.stage === 1 ? example.traceHeading : "Explain the turning point."}</h2>
    {!loaded ? <p>Loading your local progress…</p> : progress.stage === 0 ? <form onSubmit={event => { event.preventDefault(); if (progress.prediction) move(1); }}><p>{example.prompt}</p><fieldset><legend>Choose the output</legend><div className="answer-options">{example.choices.map(value => <label className="answer-option" key={value}><input type="radio" name="prediction" value={value} checked={progress.prediction === value} onChange={() => setProgress(p => ({ ...p, prediction: value }))} /><code>{value}</code></label>)}</div></fieldset><button className="button" type="submit" disabled={!progress.prediction}>Commit prediction & trace <span aria-hidden="true">→</span></button><p className="small-note">Your prediction stays visible as you inspect the trace.</p></form> : progress.stage === 1 ? <><p className="prediction-note">Your prediction: <strong>{progress.prediction}</strong></p><div className="trace-table-wrap"><table><caption>State after step {progress.trace} of {lastStep}</caption><thead><tr>{example.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody><tr><td>{current.value}</td><td>{current.condition}</td><td><strong>{current.total}</strong></td></tr></tbody></table></div><p className="trace-detail" aria-live="polite">{current.detail}</p><div className="trace-controls"><button className="button button-secondary" disabled={progress.trace === 0} onClick={() => setProgress(p => ({ ...p, trace: p.trace - 1 }))}>← Previous</button><span>{progress.trace} / {lastStep}</span><button className="button button-secondary" disabled={progress.trace === lastStep} onClick={() => setProgress(p => ({ ...p, trace: p.trace + 1 }))}>Next →</button></div><button className="button" disabled={progress.trace !== lastStep} onClick={() => move(2)}>Review the result <span aria-hidden="true">→</span></button><button className="plain-button" onClick={() => move(0)}>Revisit your prediction</button></> : <><div className="result-box"><span className="eyebrow">Observed output</span><strong className="output-value">{example.answer}</strong><p>{progress.prediction === example.answer ? "Your prediction matches the output." : `You predicted ${progress.prediction}. The trace ends at ${example.answer}.`} {example.result}</p></div><label className="explanation-label" htmlFor="explanation">{example.explanationPrompt}</label><textarea id="explanation" maxLength={1000} rows={4} placeholder="Put the key idea into your own words…" value={progress.explanation} onChange={event => setProgress(p => ({ ...p, explanation: event.target.value }))} /><p className="small-note">A note for yourself, saved in this tab. It is not graded or sent to a server.</p><details className="reasoning"><summary>Compare with an explanation</summary><p>{example.reasoning}</p></details><div className="review-actions"><button className="button button-secondary" onClick={() => move(1)}>Revisit the trace</button><a className="text-link" href="/catalog">Back to warmups →</a></div></>}
    </section></div><div className="warmup-bottom"><p>Closing this tab ends its saved session. No account or cross-device sync.</p><button className="plain-button" onClick={reset} disabled={!loaded}>Clear progress & start over</button></div>
  </div>;
}
