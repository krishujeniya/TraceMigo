import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Kysely, sql } from "kysely";
import type { Database } from "./types.js";

export interface MigrationOptions { readonly directory?: URL; readonly through?: string }
export async function migrateCore(db: Kysely<Database>, options: MigrationOptions = {}): Promise<readonly string[]> {
  const directory = options.directory ?? new URL("../migrations/core/", import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
  if (!names.length || names.some(name => !/^[0-9]{4}_[a-z0-9_]+\.sql$/.test(name))) throw new Error("Invalid migration set.");
  const files = await Promise.all(names.map(async name => {
    const body = await readFile(new URL(name, directory), "utf8");
    return { name, body, hash: createHash("sha256").update(body).digest("hex") };
  }));
  if (options.through && !names.includes(options.through)) throw new Error("Unknown migration target.");
  return db.transaction().execute(async trx => {
    await sql`SET LOCAL ROLE tracemigo_owner`.execute(trx);
    await sql`SELECT pg_advisory_xact_lock(73001700)`.execute(trx);
    await sql`CREATE TABLE IF NOT EXISTS ops.schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz NOT NULL DEFAULT now())`.execute(trx);
    const history = (await sql<{ name: string; sha256: string }>`SELECT name,sha256 FROM ops.schema_migrations ORDER BY name`.execute(trx)).rows;
    for (const [index, applied] of history.entries()) {
      if (files[index]?.name !== applied.name || files[index]?.hash !== applied.sha256) throw new Error("Migration history or checksum mismatch.");
    }
    const target = options.through ? names.indexOf(options.through) + 1 : names.length;
    if (target < history.length) throw new Error("Down migrations are not supported.");
    const completed: string[] = [];
    for (const file of files.slice(history.length, target)) {
      await sql.raw(file.body).execute(trx);
      await sql`INSERT INTO ops.schema_migrations(name,sha256) VALUES(${file.name},${file.hash})`.execute(trx);
      completed.push(file.name);
    }
    return completed;
  });
}
