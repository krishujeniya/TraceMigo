import { createHash, randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "@tracemigo/db";
import {
  IdempotencyConflictError,
  IdempotencyInFlightError,
  type IdempotencyResponseEnvelope,
} from "./types.js";

function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[k] = sortObjectKeys((value as Record<string, unknown>)[k]);
  }
  return sorted;
}

export function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(sortObjectKeys(payload));
  return createHash("sha256").update(normalized ?? "null", "utf8").digest("hex").toLowerCase();
}

export interface IdempotencyExecutionResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly cached: boolean;
}

interface OpsIdempotencyRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  route: string;
  key: string;
  request_hash: string;
  response: unknown;
  response_status: number | null;
  expires_at: Date | string;
  state: "pending" | "completed";
  created_at?: Date | string;
}

interface OpsTables {
  idempotency_records: OpsIdempotencyRecord;
}

export async function executeIdempotentOperation(
  db: Kysely<Database>,
  tenantId: string,
  userId: string,
  route: string,
  key: string,
  payload: unknown,
  operation: (trx: Kysely<Database>) => Promise<{ status: number; body: Record<string, unknown> }>
): Promise<IdempotencyExecutionResult> {
  const requestHash = hashPayload(payload);

  const runWithTrx = async (trx: Kysely<Database>): Promise<IdempotencyExecutionResult> => {
    const opsDb = (trx as unknown as Kysely<OpsTables>).withSchema("ops");
    const existing = await opsDb
      .selectFrom("idempotency_records")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("user_id", "=", userId)
      .where("route", "=", route)
      .where("key", "=", key)
      .executeTakeFirst();

    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new IdempotencyConflictError(
          `Idempotency key '${key}' was already executed with a different request payload`
        );
      }
      if (existing.state === "completed" && existing.response && existing.response_status) {
        const env = existing.response as unknown as IdempotencyResponseEnvelope;
        return {
          status: existing.response_status,
          body: env.data.body,
          cached: true,
        };
      }
      throw new IdempotencyInFlightError(
        `Operation for idempotency key '${key}' is currently pending in another transaction`
      );
    }

    const recordId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    await opsDb
      .insertInto("idempotency_records")
      .values({
        id: recordId,
        tenant_id: tenantId,
        user_id: userId,
        route,
        key,
        request_hash: requestHash,
        state: "pending",
        expires_at: expiresAt,
        response: null,
        response_status: null,
      })
      .execute();

    const result = await operation(trx);

    const responseEnvelope: IdempotencyResponseEnvelope = {
      schema_version: "idempotency.response.v1",
      data: {
        status: result.status,
        body: result.body,
      },
    };

    await opsDb
      .updateTable("idempotency_records")
      .set({
        state: "completed",
        response_status: result.status,
        response: responseEnvelope as any,
      })
      .where("id", "=", recordId)
      .execute();

    return {
      status: result.status,
      body: result.body,
      cached: false,
    };
  };

  if ((db as any).isTransaction) {
    return runWithTrx(db);
  }
  return db.transaction().execute(runWithTrx);
}
