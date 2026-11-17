import type { Example } from "./examples";

export type Progress = {
  stage: number;
  prediction: string;
  trace: number;
  explanation: string;
};

export const INITIAL: Progress = { stage: 0, prediction: "", trace: 0, explanation: "" };

export const COMPLETED_WARMUPS_KEY = "tracemigo:warmup:completed:v1";
export const MAX_ANONYMOUS_WARMUPS = 3;

export function readProgress(value: unknown, example: Example): Progress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (
    !Number.isInteger(p.stage) ||
    !Number.isInteger(p.trace) ||
    typeof p.prediction !== "string" ||
    typeof p.explanation !== "string"
  )
    return null;
  if (
    (p.stage as number) < 0 ||
    (p.stage as number) > 2 ||
    (p.trace as number) < 0 ||
    (p.trace as number) >= example.trace.length ||
    !["", ...example.choices].includes(p.prediction) ||
    p.explanation.length > 1000
  )
    return null;
  if ((p.stage as number) > 0 && !p.prediction) return null;
  if (p.stage === 2 && p.trace !== example.trace.length - 1) return null;
  return {
    stage: p.stage as number,
    prediction: p.prediction,
    trace: p.trace as number,
    explanation: p.explanation,
  };
}

export function getCompletedWarmups(): string[] {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  try {
    const raw = window.sessionStorage.getItem(COMPLETED_WARMUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function recordWarmupCompletion(id: string): string[] {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  try {
    const current = getCompletedWarmups();
    if (!current.includes(id)) {
      const updated = [...current, id];
      window.sessionStorage.setItem(COMPLETED_WARMUPS_KEY, JSON.stringify(updated));
      return updated;
    }
    return current;
  } catch {
    return [];
  }
}

export function isWarmupLimitReached(): boolean {
  return getCompletedWarmups().length >= MAX_ANONYMOUS_WARMUPS;
}

export function clearGuestWarmups(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const completed = getCompletedWarmups();
    for (const id of completed) {
      window.sessionStorage.removeItem(`tracemigo:warmup:${id}:v1`);
    }
    window.sessionStorage.removeItem(COMPLETED_WARMUPS_KEY);
  } catch {
    // Ignore storage failure
  }
}
