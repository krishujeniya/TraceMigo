# PostgreSQL schema and migrations

P02.01, 2026-10-30. Core relational authority is implemented and tested on a disposable PostgreSQL **17.7** cluster. No existing application or production database was changed. This is not authentication, deployed tenant authorization, content review by humans, billing processing or a cloud release. PostgreSQL 17.7 is the available local test binary; verify a current supported security patch before deployment.

## Layout and trust boundaries

| Path/schema | Purpose |
|---|---|
| `packages/db/bootstrap/roles.sql` | Administrator-reviewed group roles and dedicated schemas; no login passwords or service accounts |
| `migrations/core/0001_core.sql` | Identity, canonical content, attempts/events, submissions/jobs/evidence, outbox and ledger |
| `migrations/core/0002_support_and_integrity.sql` | Review/provenance, assessments/appeals, preferences/consents, billing/quota/idempotency/audit/deletion support; immutability and additive activity field |
| `migrations/optional/0002_vector_embeddings.sql` | Separate, deferred pgvector capability; never discovered by the core migration runner |
| `app` | Application relations and public-content projection metadata |
| `private` | Oracle/bundle keys, reviewer/provenance records and rubric authority |
| `ops` | Transactional outbox, financial/operational records and checksummed migration history |

All objects are owned by `tracemigo_owner`, a NOLOGIN group with no superuser/BYPASSRLS/role-creation/database-creation authority. API, peer, judge, assessment, publisher, worker, billing, identity and privacy groups are separate NOLOGIN roles with explicit privileges. Bootstrap refuses elevated existing groups, unexpected schema owners or service groups inheriting migration ownership. It revokes public database access, public schema creation and default public function execution. This bootstrap is for a dedicated database; applying it to a shared database requires a separate reviewed plan.

Provision service login identities separately using the environment's approved identity/secret mechanism; the repository does not create deployable credentials. Never grant a service membership in the owner group or combine application and judge authority. `createDatabase()` creates a separate pool per call; it never switches service roles. `verifyRole()` rejects superuser, BYPASSRLS, replication, database/role creation, migration/database ownership and combined group membership. Call it before enabling a service's database-dependent readiness. Migration credentials must not be used in the API pool.

**RLS is enabled and forced, with default-deny for all personal/tenant relations and catalog relations.** Only an explicit owner-maintenance policy exists today. Even a correctly configured nonowner app/peer role sees no rows and cannot insert personal data. Tenant/user GUCs alone do not grant access. P02.02 must implement and test reviewed owner/tenant policies and transaction-local identity propagation; P02.03 adds content visibility/publication policies. This fail-closed baseline is intentional and is not a completed authorization feature.

Private schema USAGE and object privileges are denied to API and peer groups. Rubrics and hidden bundle keys are not columns on `app.problem_versions`. Judge/assessment/content groups have only their specified private privileges. JSON payloads still need the future public-projection/answer-leak checks; this schema does not prove arbitrary user-generated JSON is safe to publish. No actual sealed content is stored in the repository or test fixtures.

## Migration operation

Use PostgreSQL 17 and the pinned workspace tools. First create a **dedicated empty database**, with an authorized administrator. Review and apply the role/bootstrap SQL with `psql -X -v ON_ERROR_STOP=1 --single-transaction -f packages/db/bootstrap/roles.sql` against that explicitly selected database. Supply host, user and database through your approved local connection configuration; never point this at an unreviewed existing database. There is no automatic provisioning or production bootstrap command.

For a separately authorized migration identity that can SET ROLE to `tracemigo_owner`, run:

```bash
TRACEMIGO_DB_HOST=/path/to/private/socket \
TRACEMIGO_DB_PORT=5432 \
TRACEMIGO_DB_USER=your_migration_login \
TRACEMIGO_DB_NAME=your_dedicated_database \
pnpm db:migrate
```

These CLI-specific variables are per-command settings, not API configuration; do not export them globally into the current API service. `TRACEMIGO_DB_PASSWORD_FILE` optionally supplies a restricted password file; its contents are never printed. Remote TCP hosts require a CA file through `TRACEMIGO_DB_CA_FILE`, with certificate verification enforced. Unix sockets and loopback permit local plaintext transport. Use different credentials/pools for migration, app and judge roles.

The runner validates ordered four-digit filenames, reads trusted source files, hashes their exact bytes, obtains a transaction-scoped advisory lock, switches only the migration transaction to the owner, and checks `ops.schema_migrations`. Applied history must be an exact name/hash prefix of the source migrations. Modified checksums, inserted earlier migrations, missing applied files and downward targets fail closed. The new SQL and history records commit in one transaction; any error rolls back the pending batch. There is no destructive down-migration command. CLI failures emit only a fixed failure event, not SQL, credentials or database error details.

`0002` is additive: it creates supporting tables/triggers and a defaulted `last_activity_at` column/index, retaining the original attempt columns. Integration tests write/read existing explicit-column clients before/after upgrade and insert again without the new column. The previous API had no DB consumer, so this is a declared v1 SQL-client compatibility fixture, not a claim of compatibility with an earlier deployed product. New migrations need separate compatibility/lock/load/backfill planning for populated databases. Do not edit an applied migration to fix production; add a reviewed forward migration.

## Integrity constraints

- Composite owner keys connect tenant/user/attempt to submissions, jobs, observations, assessment results, appeals and skill evidence. A job from another attempt cannot be used as evidence, even within the same tenant. A membership in another tenant does not satisfy the parent FK.
- Attempt stages/modes/difficulty follow ADR 0002. Attempt identity is immutable and every update increments revision exactly once. Future API If-Match, stage transitions and finalization rules remain application tasks.
- Published versions, published problem identity and private content children are immutable. Versions start in draft, publication requires review state, two distinct latest stored approvals and a private authority row. A retirement is an additional record, preserving historical content bytes/status. Revisions/reviews are database records, not evidence of two actual independent humans; assignment, authenticity, provenance completeness and publication UI remain P02.03/P10.01.
- Child-content changes lock the parent version, serializing against publication. Integrity trigger functions that inspect protected rows use narrowly scoped SECURITY DEFINER with a fixed `pg_catalog` search path and qualified table names; they do not expose general privileged query functions.
- Prerequisite graphs reject self/long/concurrent cycles. A global advisory transaction lock serializes prerequisite edits; READ COMMITTED is required so checks see the latest committed graph. Other isolation levels fail closed rather than allow a stale snapshot. Related edges may form cycles. This graph-edit restriction does not change isolation for unrelated transactions.
- Scores have six required numeric anchors in [0,4], confidence in [0,1], deterministic/human-review decision source, contiguous result revisions and append-only results. Peer services cannot grant scores. Evidence-reference semantics and scoring correctness remain P06 tasks.
- Every structured JSON payload requires an exact `schema_version`/`data` envelope, expected version, object data and 64-KiB limit. Nullable pending idempotency responses are explicitly allowed; completed responses require valid payload/status. Assessment anchors get additional strict domain validation. Detailed AST/source-span, provenance and provider payload semantics are validated in later domain tasks; an envelope is not full semantic validation.
- Operation IDs, principal/route/idempotency keys, provider/event IDs, version/reviewer/revision tuples and purchase/product identities are unique. Outbox identity/payload cannot be rewritten; publication timestamps and retry counts cannot regress. Idempotency identity/request hash is immutable, and completed responses cannot be rewritten.
- Ledger, audit, submissions and event rows are append-only. Quota, entitlement, consent, deletion and appeal checks reject malformed states/time ranges/parents. Deletion tombstones intentionally outlive user rows and therefore retain opaque user identifiers without a live-user FK; retention/legal approval is still required. Recorded actual quota usage may exceed its estimate so invoices can be reconciled honestly; this schema alone is not a spend cap.

Owner/admin migration authority can alter or remove database protections. Append-only triggers are not a defense against a compromised migration administrator. Service identities must remain nonowners without TRUNCATE or schema/role creation grants. No live service permissions or identity-provider integration have been deployed here.

## Transactions and typed clients

`@tracemigo/db` exports Kysely application table types, `createDatabase()`, `migrateCore()` and parameterized `sql`. Bigint fields are strings on reads; money uses integer micro-units, not floating-point dollars. JSON schemas are checked at the DB boundary in addition to TypeScript types. The constructor bounds pool size/timeouts and configures an explicit application search path; it emits no query/error payload logs. Idle pool errors mark local health unhealthy; `health()` performs a real SELECT and can recover after a successful reconnect. The API's current readiness still describes only its foundation and does not register a database probe yet.

Keep business changes, usage reservation, idempotency and outbox insertion in the **same transaction**. The integration test proves both the business revision and outbox insertion disappear on rollback, then verifies committed operation uniqueness. There is no delivery worker, exactly-once transport claim or automatic published-outbox cleanup yet.

## Real database tests

Run against an explicitly created **disposable** private Unix-socket cluster:

```bash
TRACEMIGO_TEST_PG_SOCKET=/tmp/tracemigo-pg17-YOUR_RUN/socket \
TRACEMIGO_TEST_PG_PORT=55432 \
TRACEMIGO_TEST_PG_ADMIN=your_disposable_cluster_admin \
pnpm test:integration
```

The harness requires an owned private `/tmp/tracemigo-pg17-*` socket directory and creates only randomly named fresh test databases and test login identities in that cluster. It never drops or migrates an existing database, and missing connection settings fail rather than skip. Do not use a shared or real environment for this harness. Local test-only trust authentication is confined to the private socket directory; the verified cluster had TCP disabled. Tests do not execute any learner code.

The P02.01 evidence wrapper initializes a new private cluster, runs the checks and stops it; private files are retained for inspection. Logs/results are under ignored `planning/evidence/P02.01/` and must be handed off explicitly. Tests cover fresh/upgrade/replay, checksum/order drift, failed-DDL rollback, concurrent migrators, role denial, revision/ownership/JSON/score constraints, publication/child immutability, DAG concurrency and outbox atomicity. Existing unit/API/build/startup/shutdown checks also run. Optional pgvector is deferred and NOT RUN; core tests confirm the extension is absent.

Sources checked for this implementation: [PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html), [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Kysely migration principles](https://kysely.dev/docs/migrations), and [node-postgres transaction connections](https://node-postgres.com/features/transactions). Dependency versions are pinned in the manifest/lockfile. This code uses a custom checksummed SQL runner over Kysely transactions; it does not claim to use Kysely's built-in migration-history format.
