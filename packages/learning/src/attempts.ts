import { sql, type Kysely } from "kysely";
import type { Database } from "@tracemigo/db";
import {
  AttemptFinalizedError,
  ConcurrentModificationError,
  InvalidStageTransitionError,
  SoloMockDisclosureError,
  type AdvanceStageParams,
  type AttemptRecord,
  type AttemptStage,
  type AutosaveParams,
  type CreateAttemptParams,
  type SubmitAttemptParams,
} from "./types.js";
import { appendAttemptEvent } from "./events.js";

const ALLOWED_STAGE_TRANSITIONS: Record<AttemptStage, readonly AttemptStage[]> = {
  warmup: ["predict"],
  predict: ["trace"],
  trace: ["explain"],
  explain: ["mutate", "review"],
  mutate: ["review"],
  review: [],
};

export async function createAttempt(
  trx: Kysely<Database>,
  params: CreateAttemptParams
): Promise<AttemptRecord> {
  if (params.contextSource === "spaced_retrieval" && !params.priorAttemptId) {
    throw new Error("Spaced retrieval attempts require a prior_attempt_id");
  }

  const now = new Date();
  const record = {
    id: params.id,
    tenant_id: params.tenantId,
    user_id: params.userId,
    problem_version_id: params.problemVersionId,
    mode: params.mode,
    stage: "warmup" as const,
    status: "active" as const,
    revision: "0" as any,
    disclosure_level: 0,
    context_source: params.contextSource ?? ("direct" as const),
    prior_attempt_id: params.priorAttemptId ?? null,
  };

  await trx.insertInto("attempts").values(record).execute();

  await appendAttemptEvent(
    trx,
    params.tenantId,
    params.userId,
    params.id,
    "attempt_created",
    { mode: params.mode, problem_version_id: params.problemVersionId },
    "warmup"
  );

  return {
    id: params.id,
    tenant_id: params.tenantId,
    user_id: params.userId,
    problem_version_id: params.problemVersionId,
    mode: params.mode,
    stage: "warmup",
    status: "active",
    revision: 0,
    disclosure_level: 0,
    context_source: params.contextSource ?? "direct",
    prior_attempt_id: params.priorAttemptId ?? null,
    started_at: now,
    finished_at: null,
    last_activity_at: now,
  };
}

export async function advanceStage(
  trx: Kysely<Database>,
  params: AdvanceStageParams
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", params.tenantId)
    .where("user_id", "=", params.userId)
    .where("id", "=", params.attemptId)
    .forUpdate()
    .executeTakeFirst();

  if (!attempt) {
    throw new Error(`Attempt ${params.attemptId} not found`);
  }

  if (["completed", "abandoned", "submitted"].includes(attempt.status)) {
    throw new AttemptFinalizedError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== params.expectedRevision) {
    throw new ConcurrentModificationError(
      `Revision mismatch on attempt ${params.attemptId}: expected ${params.expectedRevision}, found ${currentRevision}`
    );
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[attempt.stage as AttemptStage];
  if (!allowed?.includes(params.toStage)) {
    throw new InvalidStageTransitionError(
      `Cannot transition attempt stage from '${attempt.stage}' to '${params.toStage}'`
    );
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      stage: params.toStage,
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", params.attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    params.tenantId,
    params.userId,
    params.attemptId,
    "stage_advanced",
    params.eventDetails,
    params.toStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: params.toStage,
    status: attempt.status as any,
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function autosaveAttempt(
  trx: Kysely<Database>,
  params: AutosaveParams
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", params.tenantId)
    .where("user_id", "=", params.userId)
    .where("id", "=", params.attemptId)
    .forUpdate()
    .executeTakeFirst();

  if (!attempt) {
    throw new Error(`Attempt ${params.attemptId} not found`);
  }

  if (["completed", "abandoned", "submitted"].includes(attempt.status)) {
    throw new AttemptFinalizedError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== params.expectedRevision) {
    throw new ConcurrentModificationError(
      `Revision mismatch during autosave: expected ${params.expectedRevision}, found ${currentRevision}`
    );
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", params.attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    params.tenantId,
    params.userId,
    params.attemptId,
    params.eventType,
    params.eventDetails,
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: attempt.status as any,
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function pauseAttempt(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  expectedRevision: number
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== expectedRevision) {
    throw new ConcurrentModificationError();
  }

  if (attempt.status !== "active") {
    throw new Error(`Cannot pause attempt in state '${attempt.status}'`);
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      status: "paused",
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    tenantId,
    userId,
    attemptId,
    "attempt_paused",
    { previous_status: "active" },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: "paused",
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function resumeAttempt(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  expectedRevision: number
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== expectedRevision) {
    throw new ConcurrentModificationError();
  }

  if (attempt.status !== "paused") {
    throw new Error(`Cannot resume attempt in state '${attempt.status}'`);
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      status: "active",
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    tenantId,
    userId,
    attemptId,
    "attempt_resumed",
    { previous_status: "paused" },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: "active",
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function requestDisclosure(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  expectedRevision: number
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  if (attempt.mode === "mock_solo") {
    throw new SoloMockDisclosureError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== expectedRevision) {
    throw new ConcurrentModificationError();
  }

  const nextDisclosure = Math.min(6, attempt.disclosure_level + 1);
  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      disclosure_level: nextDisclosure,
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    tenantId,
    userId,
    attemptId,
    "disclosure_requested",
    { previous_level: attempt.disclosure_level, new_level: nextDisclosure },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: attempt.status as any,
    revision: nextRevision,
    disclosure_level: nextDisclosure,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function submitAttempt(
  trx: Kysely<Database>,
  params: SubmitAttemptParams
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", params.tenantId)
    .where("user_id", "=", params.userId)
    .where("id", "=", params.attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  if (["completed", "abandoned", "submitted"].includes(attempt.status)) {
    throw new AttemptFinalizedError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== params.expectedRevision) {
    throw new ConcurrentModificationError();
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  // Create immutable submission record
  await trx
    .insertInto("submissions")
    .values({
      id: params.submissionId,
      tenant_id: params.tenantId,
      user_id: params.userId,
      attempt_id: params.attemptId,
      source_sha256: params.sourceSha256,
      object_key: params.objectKey,
    })
    .execute();

  await trx
    .updateTable("attempts")
    .set({
      status: "submitted",
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", params.attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    params.tenantId,
    params.userId,
    params.attemptId,
    "attempt_submitted",
    { submission_id: params.submissionId, source_sha256: params.sourceSha256 },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: "submitted",
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: attempt.finished_at as any,
    last_activity_at: now,
  };
}

export async function completeAttempt(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  expectedRevision: number
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  if (["completed", "abandoned"].includes(attempt.status)) {
    throw new AttemptFinalizedError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== expectedRevision) {
    throw new ConcurrentModificationError();
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      status: "completed",
      finished_at: now,
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    tenantId,
    userId,
    attemptId,
    "attempt_completed",
    { previous_status: attempt.status },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: "completed",
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: now,
    last_activity_at: now,
  };
}

export async function abandonAttempt(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  expectedRevision: number
): Promise<AttemptRecord> {
  const attempt = await trx
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  if (["completed", "abandoned"].includes(attempt.status)) {
    throw new AttemptFinalizedError();
  }

  const currentRevision = Number(attempt.revision);
  if (currentRevision !== expectedRevision) {
    throw new ConcurrentModificationError();
  }

  const nextRevision = currentRevision + 1;
  const now = new Date();

  await trx
    .updateTable("attempts")
    .set({
      status: "abandoned",
      finished_at: now,
      revision: String(nextRevision) as any,
      last_activity_at: now,
    })
    .where("id", "=", attemptId)
    .execute();

  await appendAttemptEvent(
    trx,
    tenantId,
    userId,
    attemptId,
    "attempt_abandoned",
    { previous_status: attempt.status },
    attempt.stage as AttemptStage
  );

  return {
    id: attempt.id,
    tenant_id: attempt.tenant_id,
    user_id: attempt.user_id,
    problem_version_id: attempt.problem_version_id,
    mode: attempt.mode as any,
    stage: attempt.stage as any,
    status: "abandoned",
    revision: nextRevision,
    disclosure_level: attempt.disclosure_level,
    context_source: attempt.context_source as any,
    prior_attempt_id: attempt.prior_attempt_id,
    started_at: attempt.started_at as any,
    finished_at: now,
    last_activity_at: now,
  };
}

export async function getAttempt(
  db: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string
): Promise<AttemptRecord | undefined> {
  const row = await db
    .selectFrom("attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("id", "=", attemptId)
    .executeTakeFirst();

  if (!row) return undefined;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    problem_version_id: row.problem_version_id,
    mode: row.mode as any,
    stage: row.stage as any,
    status: row.status as any,
    revision: Number(row.revision),
    disclosure_level: row.disclosure_level,
    context_source: row.context_source as any,
    prior_attempt_id: row.prior_attempt_id,
    started_at: row.started_at as any,
    finished_at: row.finished_at as any,
    last_activity_at: row.last_activity_at as any,
  };
}
