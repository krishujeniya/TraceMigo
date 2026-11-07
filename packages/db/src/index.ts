import pg from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import type { Database } from "./types.js";
export type { Database, Envelope } from "./types.js";
export { migrateCore } from "./migrations.js";
export { sql } from "kysely";

export interface ConnectionOptions {
  readonly host: string; readonly port?: number; readonly user: string; readonly database: string;
  readonly password?: string; readonly max?: number; readonly ssl?: { readonly rejectUnauthorized: true; readonly ca?: string };
}
export const serviceRoles = ["tracemigo_app_role", "tracemigo_peer_role", "tracemigo_judge_role", "tracemigo_assessment_role", "tracemigo_publisher_role", "tracemigo_worker_role", "tracemigo_billing_role", "tracemigo_identity_role", "tracemigo_privacy_role"] as const;
export type ServiceRole = typeof serviceRoles[number];
export function createDatabase(config: ConnectionOptions) {
  const max = config.max ?? 5, port = config.port ?? 5432;
  if (!config.host || !config.user || !config.database || !Number.isInteger(max) || max < 1 || max > 20 || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid database configuration.");
  if (!config.host.startsWith("/") && !["localhost", "127.0.0.1", "::1"].includes(config.host) && config.ssl?.rejectUnauthorized !== true) throw new Error("Verified TLS is required for remote databases.");
  const pool = new pg.Pool({ ...config, max, port, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    options: "-c search_path=app,pg_catalog -c statement_timeout=5000 -c lock_timeout=3000",
  });
  let poolFailed = false;
  pool.on("error", () => { poolFailed = true; });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }).withSchema("app");
  return {
    db,
    async health(): Promise<boolean> {
      try { await sql`select 1`.execute(db); poolFailed = false; return true; } catch { poolFailed = true; return false; }
    },
    poolHealthy: () => !poolFailed,
    async verifyRole(expected: ServiceRole): Promise<void> {
      if (!serviceRoles.includes(expected)) throw new Error("Invalid database service role.");
      const result = await sql<{ safe: boolean }>`SELECT
        NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
        AND NOT pg_has_role(current_user,'tracemigo_owner','MEMBER')
        AND NOT pg_has_role(current_user,'pg_database_owner','MEMBER')
        AND pg_has_role(current_user,${expected},'MEMBER')
        AND (SELECT count(*) FROM pg_roles p WHERE p.rolname = ANY(${[...serviceRoles]}::text[]) AND pg_has_role(current_user,p.oid,'MEMBER'))=1 AS safe
        FROM pg_roles r WHERE r.rolname=current_user`.execute(db);
      if (result.rows[0]?.safe !== true) throw new Error("Unsafe database service identity.");
    },
    destroy: () => db.destroy(),
  };
}
