import type { WorkspaceProtocol } from "@tracemigo/contracts";

/** Transport envelope; this package cannot execute submitted code. */
export interface ExecutionReference {
  readonly protocol: WorkspaceProtocol;
  readonly submissionId: string;
}
