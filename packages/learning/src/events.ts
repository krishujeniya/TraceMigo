import { randomUUID } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { Database } from "@tracemigo/db";
import type {
  AttemptEventEnvelope,
  AttemptEventRecord,
  AttemptStage,
  SSEMessage,
} from "./types.js";

export async function getNextEventSeq(
  trx: Kysely<Database>,
  tenantId: string,
  attemptId: string
): Promise<number> {
  const res = await trx
    .selectFrom("attempt_events")
    .select(sql<string>`COALESCE(MAX(seq), 0)`.as("max_seq"))
    .where("tenant_id", "=", tenantId)
    .where("attempt_id", "=", attemptId)
    .executeTakeFirstOrThrow();

  return Number(res.max_seq) + 1;
}

export async function appendAttemptEvent(
  trx: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  eventType: string,
  eventDetails?: Record<string, unknown> | undefined,
  stage?: AttemptStage | undefined
): Promise<AttemptEventRecord> {
  const seq = await getNextEventSeq(trx, tenantId, attemptId);
  const eventId = randomUUID();
  const timestamp = new Date().toISOString();

  const envelope: AttemptEventEnvelope = {
    schema_version: "attempt.event.v1",
    data: {
      event_type: eventType,
      timestamp,
      ...(stage ? { stage } : {}),
      ...(eventDetails ? { details: eventDetails } : {}),
    },
  };

  await trx
    .insertInto("attempt_events")
    .values({
      tenant_id: tenantId,
      user_id: userId,
      attempt_id: attemptId,
      seq: String(seq) as any,
      event_id: eventId,
      event_type: eventType,
      payload: envelope as any,
    })
    .execute();

  return {
    tenant_id: tenantId,
    user_id: userId,
    attempt_id: attemptId,
    seq,
    event_id: eventId,
    event_type: eventType,
    payload: envelope,
    created_at: new Date(timestamp),
  };
}

export async function replayEvents(
  db: Kysely<Database>,
  tenantId: string,
  userId: string,
  attemptId: string,
  fromSeq = 0
): Promise<readonly SSEMessage[]> {
  const rows = await db
    .selectFrom("attempt_events")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("user_id", "=", userId)
    .where("attempt_id", "=", attemptId)
    .where(sql<boolean>`seq > ${fromSeq}`)
    .orderBy("seq", "asc")
    .execute();

  return rows.map((row) => {
    const env = row.payload as unknown as AttemptEventEnvelope;
    return {
      id: String(row.seq),
      event: row.event_type,
      data: JSON.stringify(env.data),
    };
  });
}

export function formatSSEMessage(msg: SSEMessage): string {
  return `id: ${msg.id}\nevent: ${msg.event}\ndata: ${msg.data}\n\n`;
}
