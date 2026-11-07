# ADR 0001: Repository layout and workspace topology

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: ENG (TraceMigo Core Architecture)
- **Reviewers**: OPS, SECURITY
- **Traceability**: REQ-P-07, REQ-P-08, Audit A01, A03, A04

## Context and Problem Statement

TraceMigo requires coordinating a web client, backend APIs, relational databases, isolated runtime execution environments, tracing pipelines, and cloud infrastructure. The original plan proposed a Turborepo + pnpm modular monolith alongside Python runner components, but placed working planning documents at root. Furthermore, `planning/` must remain ignored by git while production architecture documents, ADRs, runbooks, and code remain versioned.

## Decision

1. **Monorepo Structure**: Use a TypeScript modular monolith managed by pnpm workspaces and Turborepo, co-located with a Python runner workspace managed by `uv`.
2. **Directory Layout**:
   - `apps/web`: Next.js/React application serving public landing, catalog, anonymous warmups, and authenticated learning workspaces.
   - `packages/contracts`: Shared schemas (Zod/TypeBox), API request/response definitions, error models (RFC 7807 Problem Details), and telemetry events.
   - `packages/db`: Kysely migrations, schema definitions, and connection factories for PostgreSQL.
   - `packages/identity`: Authentication, session verification, OIDC client adapters, and Row-Level Security (RLS) context wrappers.
   - `packages/catalog`: Case metadata, manifest parsers, tag taxonomy, and public content projections.
   - `packages/learning`: Learning state machine, attempt lifecycle, session progression, and event journaling.
   - `packages/peer`: AI peer policy, hint throttling, state machine, and provider abstractions.
   - `packages/assessment`: Deterministic rubric evaluators, complexity anchors, and diff/patch analysis.
   - `packages/billing`: Razorpay integration, entitlement ledgers, quota reservations, and webhook verifiers.
   - `packages/privacy`: Consent management, data export generators, and deletion/tombstone orchestrators.
   - `packages/ui`: Shared UI components, theme tokens (Manrope, design variables), and accessibility primitives.
   - `services/judge-controller`: Fastify / gRPC service orchestrating isolated execution jobs, receiving trace events, and evaluating oracle assertions.
   - `runtimes/python`: Pinned Python tracer, AST span analyzer, and execution harness executed inside isolated gVisor/sandbox containers.
   - `infra/terraform`: Terraform modules for cloud infrastructure (GCP Cloud Run, GKE Sandbox, Cloud SQL, Pub/Sub, Cloud Storage).
   - `infra/kubernetes`: Sandbox pod definitions, admission controls, network policies, and resource quotas.
   - `docs/`: Version-controlled architectural records, ADRs, threat models, runbooks, and release evidence indexes.
   - `planning/`: Git-ignored workspace for private planning scratchpads, task working trackers, and unreviewed exploratory assets.
3. **Planning Handoff**: `planning/` is preserved in `.gitignore`. Production-critical decisions are extracted and preserved under `docs/` so that clean repository checkouts contain all authoritative architectural records.

## Consequences

- **Positive**: Clean separation of concerns between trusted web/monolith packages and untrusted isolated runner execution; clear dependency graphs; single tooling pipeline for linting, testing, and typechecking.
- **Negative**: Requires multi-runtime CI (Node.js/pnpm and Python/uv); developers must maintain workspace boundaries strictly.
