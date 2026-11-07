# ADR 0004: Vector search scope and deferred pgvector migration

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: ENG (TraceMigo Core Architecture)
- **Reviewers**: OPS, FINANCE
- **Traceability**: REQ-P-07, Audit A06

## Context and Problem Statement

In `plan.md`, the architectural narrative stated that vector search was an optional enhancement, yet the initial SQL schema proposal included an unconditional `CREATE EXTENSION IF NOT EXISTS vector;` and defined an `exercise_embeddings` table with 1536-dimensional vector columns.

Requiring `pgvector` from day one introduces several serious drawbacks:
1. Operational complexity and cost: Managed PostgreSQL instances with vector extensions require substantial shared memory buffers and specialized maintenance (HNSW/IVFFlat index builds).
2. Unnecessary complexity for initial catalog: The initial launch contains 30 Python cases and 30 micro-exercises. A 30-case collection does not require approximate nearest-neighbor vector indexing; exact relational filtering and full-text search are orders of magnitude faster, deterministic, and cost-effective.
3. External dependency: Embeddings require an external model API (or local embedding container), adding latency and variable API costs.

## Decision

1. **Relational Authority for Initial Scope**:
   For the initial Python release (P00 through P12), all case discovery, diagnostic routing, concept prerequisite navigation, and keyword lookups will rely exclusively on standard PostgreSQL features:
   - Relational foreign keys and junction tables for concept hierarchies and prerequisite DAGs.
   - B-Tree indexes on `track_id`, `difficulty`, `status`, and publication timestamps.
   - GIN indexes on JSONB tag arrays.
   - Native PostgreSQL full-text search using `tsvector` / `tsquery` over case titles, descriptions, and concept summaries:
     ```sql
     CREATE INDEX idx_problems_search ON problems USING GIN (search_tsv);
     ```

2. **Decoupled and Deferred Vector Migration**:
   - `CREATE EXTENSION vector` is strictly excluded from initial database bootstrap migrations (`packages/db/migrations/core/`).
   - All vector-related tables and embedding schemas are placed in an optional migration path:
     `packages/db/migrations/optional/0002_vector_embeddings.sql`.
   - The application must boot, run tests, and serve all learning workflows without the vector extension installed.

3. **Reconsideration Trigger**:
   Semantic vector retrieval will be re-evaluated only when:
   - The catalog exceeds 500 independently authored cases, or
   - User analytics demonstrate that relational keyword/concept search fails learner discovery needs.

## Consequences

- **Positive**: Drastically simplifies local development (developers do not need `pgvector` binaries); reduces Cloud SQL memory requirements and baseline hosting costs; eliminates flaky external embedding API dependencies during test runs.
- **Negative**: Semantic similarity matching across problems (e.g., "find problems conceptually similar to this code snippet") is not available in V1; learners must rely on explicit concept tags and keyword search.
