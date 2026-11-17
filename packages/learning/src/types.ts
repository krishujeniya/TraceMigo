export type AttemptMode = "practice" | "mock_solo" | "mock_ai";

export type AttemptStage = "warmup" | "predict" | "trace" | "explain" | "mutate" | "review";

export type AttemptStatus =
  | "active"
  | "paused"
  | "submitted"
  | "assessing"
  | "completed"
  | "abandoned";

export type ContextSource = "direct" | "spaced_retrieval";

export interface Envelope<TVersion extends string, TData extends Record<string, unknown>> {
  readonly schema_version: TVersion;
  readonly data: TData;
}

export type AttemptEventData = {
  readonly event_type: string;
  readonly timestamp: string;
  readonly stage?: AttemptStage | undefined;
  readonly details?: Record<string, unknown> | undefined;
};

export type AttemptEventEnvelope = Envelope<"attempt.event.v1", AttemptEventData>;

export type IdempotencyResponseData = {
  readonly status: number;
  readonly body: Record<string, unknown>;
};

export type IdempotencyResponseEnvelope = Envelope<
  "idempotency.response.v1",
  IdempotencyResponseData
>;

export interface AttemptRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly user_id: string;
  readonly problem_version_id: string;
  readonly mode: AttemptMode;
  readonly stage: AttemptStage;
  readonly status: AttemptStatus;
  readonly revision: number;
  readonly disclosure_level: number;
  readonly context_source: ContextSource;
  readonly prior_attempt_id: string | null;
  readonly started_at: Date;
  readonly finished_at: Date | null;
  readonly last_activity_at: Date;
}

export interface AttemptEventRecord {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly attempt_id: string;
  readonly seq: number;
  readonly event_id: string;
  readonly event_type: string;
  readonly payload: AttemptEventEnvelope;
  readonly created_at: Date;
}

export interface CreateAttemptParams {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly problemVersionId: string;
  readonly mode: AttemptMode;
  readonly contextSource?: ContextSource | undefined;
  readonly priorAttemptId?: string | undefined;
}

export interface AdvanceStageParams {
  readonly attemptId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly toStage: AttemptStage;
  readonly expectedRevision: number;
  readonly eventDetails?: Record<string, unknown> | undefined;
}

export interface AutosaveParams {
  readonly attemptId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly expectedRevision: number;
  readonly eventType: string;
  readonly eventDetails: Record<string, unknown>;
}

export interface SubmitAttemptParams {
  readonly attemptId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly expectedRevision: number;
  readonly submissionId: string;
  readonly sourceSha256: string;
  readonly objectKey: string;
}

export interface SSEMessage {
  readonly id: string;
  readonly event: string;
  readonly data: string;
}

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = "Idempotency key already exists with differing request payload") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyInFlightError extends Error {
  readonly statusCode = 409;
  constructor(message = "Operation is currently in progress for this idempotency key") {
    super(message);
    this.name = "IdempotencyInFlightError";
  }
}

export class ConcurrentModificationError extends Error {
  readonly statusCode = 409;
  constructor(message = "Attempt has been concurrently modified; revision mismatch") {
    super(message);
    this.name = "ConcurrentModificationError";
  }
}

export class InvalidStageTransitionError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidStageTransitionError";
  }
}

export class SoloMockDisclosureError extends Error {
  readonly statusCode = 403;
  constructor(message = "Peer disclosure and hints are forbidden in solo mock mode prior to submission") {
    super(message);
    this.name = "SoloMockDisclosureError";
  }
}

export class AttemptFinalizedError extends Error {
  readonly statusCode = 400;
  constructor(message = "Attempt is already submitted or completed; further mutations denied") {
    super(message);
    this.name = "AttemptFinalizedError";
  }
}
