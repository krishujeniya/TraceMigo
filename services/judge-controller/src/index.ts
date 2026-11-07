import type { ExecutionReference } from "@tracemigo/execution-client";

/** Trusted orchestration boundary; no dispatch or learner execution implemented. */
export interface JudgeJob {
  readonly execution: ExecutionReference;
  readonly leaseEpoch: number;
}
