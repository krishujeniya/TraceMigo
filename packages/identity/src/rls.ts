import { sql, type Kysely, type Transaction } from "kysely";
import type { Database } from "@tracemigo/db";
import type { TenantContext } from "./types.js";

/**
 * Executes a function within a PostgreSQL transaction scoped strictly to
 * a specific tenant, user, and role using `SET LOCAL`.
 *
 * Invariant: All session variables use `SET LOCAL`, preventing connection pool
 * state leakage. If context is missing or invalid, default-deny RLS applies.
 */
export async function withTenantContext<T>(
  db: Kysely<Database>,
  context: TenantContext,
  operation: (trx: Transaction<Database>) => Promise<T>
): Promise<T> {
  const { tenantId, userId, role } = context;

  if (!tenantId || !userId || !role) {
    throw new Error("Invalid tenant context: tenantId, userId, and role are strictly required.");
  }

  // Execute in transaction block to bind set_config(..., true) (SET LOCAL) to this specific transaction
  return db.transaction().execute(async (trx) => {
    // Set transaction-local session variables using set_config(..., is_local = true)
    await sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true),
                     set_config('app.current_user_id', ${userId}, true),
                     set_config('app.current_role', ${role}, true)`.execute(trx);

    return await operation(trx);
  });
}

/**
 * Applies RLS security policies on tenant-scoped tables for tracemigo_app_role.
 * Must be executed with tracemigo_owner / superuser privileges.
 */
export async function applyIdentityRlsPolicies(db: Kysely<Database>): Promise<void> {
  await sql.raw(`
    GRANT USAGE ON SCHEMA app TO tracemigo_app_role;

    GRANT SELECT, INSERT, UPDATE, DELETE ON app.attempts TO tracemigo_app_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.submissions TO tracemigo_app_role;
    GRANT SELECT, INSERT ON app.attempt_events TO tracemigo_app_role;
    GRANT SELECT ON app.tenants, app.users, app.memberships TO tracemigo_app_role;
    GRANT SELECT ON app.problems, app.problem_versions TO tracemigo_app_role;

    -- Drop any conflicting policy names before recreating
    DROP POLICY IF EXISTS app_attempt_tenant_isolation ON app.attempts;
    DROP POLICY IF EXISTS app_submission_tenant_isolation ON app.submissions;
    DROP POLICY IF EXISTS app_events_tenant_isolation ON app.attempt_events;
    DROP POLICY IF EXISTS app_problems_select ON app.problems;
    DROP POLICY IF EXISTS app_versions_select ON app.problem_versions;
    DROP POLICY IF EXISTS app_tenants_select ON app.tenants;
    DROP POLICY IF EXISTS app_users_select ON app.users;
    DROP POLICY IF EXISTS app_memberships_select ON app.memberships;

    -- 1. Attempts isolation policy
    CREATE POLICY app_attempt_tenant_isolation ON app.attempts
      FOR ALL TO tracemigo_app_role
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND (
          user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR current_setting('app.current_role', true) IN ('admin', 'reviewer')
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      );

    -- 2. Submissions isolation policy
    CREATE POLICY app_submission_tenant_isolation ON app.submissions
      FOR ALL TO tracemigo_app_role
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND (
          user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR current_setting('app.current_role', true) IN ('admin', 'reviewer')
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      );

    -- 3. Attempt events isolation policy
    CREATE POLICY app_events_tenant_isolation ON app.attempt_events
      FOR ALL TO tracemigo_app_role
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      );

    -- 4. Catalog policies
    CREATE POLICY app_problems_select ON app.problems
      FOR SELECT TO tracemigo_app_role
      USING (true);

    CREATE POLICY app_versions_select ON app.problem_versions
      FOR SELECT TO tracemigo_app_role
      USING (status = 'published');

    -- 5. Tenants, users, memberships lookup policies
    CREATE POLICY app_tenants_select ON app.tenants
      FOR SELECT TO tracemigo_app_role
      USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

    CREATE POLICY app_users_select ON app.users
      FOR SELECT TO tracemigo_app_role
      USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

    CREATE POLICY app_memberships_select ON app.memberships
      FOR SELECT TO tracemigo_app_role
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      );
  `).execute(db);
}
