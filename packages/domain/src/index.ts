import type { WorkspaceProtocol } from "@tracemigo/contracts";

/** Context shape; no scoring or persistence behavior is implemented yet. */
export interface AttemptContext {
  readonly attemptId: string;
  readonly protocol: WorkspaceProtocol;
}
