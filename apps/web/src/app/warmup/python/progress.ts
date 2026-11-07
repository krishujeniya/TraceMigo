import type { Example } from "./examples";

export type Progress = { stage: number; prediction: string; trace: number; explanation: string };
export const INITIAL: Progress = { stage: 0, prediction: "", trace: 0, explanation: "" };
export function readProgress(value: unknown, example: Example): Progress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (!Number.isInteger(p.stage) || !Number.isInteger(p.trace) || typeof p.prediction !== "string" || typeof p.explanation !== "string") return null;
  if ((p.stage as number) < 0 || (p.stage as number) > 2 || (p.trace as number) < 0 || (p.trace as number) >= example.trace.length || !["", ...example.choices].includes(p.prediction) || p.explanation.length > 1000) return null;
  if ((p.stage as number) > 0 && !p.prediction) return null;
  if (p.stage === 2 && p.trace !== example.trace.length - 1) return null;
  return { stage: p.stage as number, prediction: p.prediction, trace: p.trace as number, explanation: p.explanation };
}

