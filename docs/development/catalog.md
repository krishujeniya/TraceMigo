# Catalog, Content Schemas, and Immutable Publication

P02.03, 2026-11-07. Implements `@tracemigo/catalog`, authoritative content schemas in `content/schemas/`, public/private projection isolation, deterministic SHA-256 artifact hashing, and the immutable publication state machine.

---

## 1. Architectural Scope and Design Invariants

`@tracemigo/catalog` manages authoring contracts, content schema enforcement, and publication lifecycle states. It enforces:

| Control | Specification | Invariant |
|---|---|---|
| **Projection Isolation** | [ADR 0005](../adr/0005-content-publication-and-private-bundle-isolation.md) | Public projections strip all private bundles, keys, oracle sources, rubrics, and sourcemaps. |
| **Assessment Secrecy** | [ADR 0006](../adr/0006-content-derivation-and-assessment-secrecy.md) | Sealed assessment cases cannot be projected to the public catalog or discovery views. |
| **Review Quorum** | `private.guard_publication()` | A problem version requires at least two distinct approved reviews in `private.content_reviews` and an authority record in `private.problem_authorities` before moving to `published`. |
| **Publication Immutability** | PostgreSQL triggers | Published versions and problem identities are permanently immutable; corrections require a new version (`version_number + 1`) or formal retirement. |
| **Deterministic Hashing** | SHA-256 (64 hex lowercase) | `content_hash` guarantees public manifest integrity; `oracle_hash` and `witness_hash` guarantee evaluation integrity. |

---

## 2. Content Schemas (`content/schemas/`)

Authoritative JSON schemas define case structure and assessment envelopes:

- `content/schemas/case.public.v1.json`: Public case manifest envelope containing `title`, `slug`, `summary`, `difficulty`, `entrypoint`, `files`, and optional `hints` / `warmup_refs`.
- `content/schemas/case.private.v1.json`: Restricted evaluation bundle containing `oracle_source`, `hidden_test_cases`, `expected_witness_hash`, and dimensional rubric definitions.
- `content/schemas/content.review.v1.json`: Peer curriculum review notes verifying checklist items prior to publication.
- `content/schemas/rubric.anchors.v1.json`: Six-dimensional scoring anchors (0–4 scale).

All schemas conform to PostgreSQL `app.valid_envelope(payload, version)` constraints.

---

## 3. Public / Private Projections and Anti-Leakage Defense

Public projections convert internal published problem records into safe learner-facing objects:

```typescript
import { createPublicProjection } from '@tracemigo/catalog';

const projection = createPublicProjection(problem, publishedVersion);
```

### Defense-in-Depth Leakage Scanner (`assertNoLeakage`)
Every projection is deep-scanned before output:
- **Forbidden Keys**: Rejects objects containing `private_bundle_key`, `oracle_source`, `oracle_hash`, `witness_hash`, `hidden_test_cases`, `rubric_definitions`, or `source_provenance`.
- **Forbidden Content Patterns**: Rejects payloads containing private key headers (`BEGIN PRIVATE KEY`), sourcemap references (`sourceMappingURL=`, `.js.map`, `.ts.map`), or confidential test assertions.
- Violation immediately raises `ProjectionLeakageError`.

---

## 4. Publication Lifecycle State Machine

```
+------------+       submitForReview()      +------------+        publishVersion()       +---------------+
|   DRAFT    |  ------------------------->  |   REVIEW   |  -------------------------->  |   PUBLISHED   |
+------------+                              +------------+                               +---------------+
                                                  ^                                              |
                                                  |                                              |
                                                  +--- 2x Approving Reviews in                   | retireVersion()
                                                       private.content_reviews                   v
                                                       + Authority in problem_authorities  +---------------+
                                                                                           |    RETIRED    |
                                                                                           +---------------+
```

1. **Draft Creation** (`createDraftVersion`): All versions enter the system in `draft` status. Direct insertion with status `published` is rejected by PostgreSQL trigger `private.guard_publication()`.
2. **Authority Attachment** (`attachAuthority`): Restricted bundle keys and hashes are written to `private.problem_authorities`.
3. **Submit for Review** (`submitForReview`): Transitions status from `draft` to `review`.
4. **Independent Reviews** (`recordContentReview`): Reviewers inspect content and record decisions (`approve`, `reject`, `changes_requested`).
5. **Publication** (`publishVersion`): Enforces two distinct latest approved reviewer records. Moves status to `published` and sets `published_at = now()`.
6. **Retirement** (`retireVersion`): Retires an active version with an additive audit record in `app.problem_retirements` containing a valid uppercase reason code (e.g. `CURRICULUM_REFRESH`). Direct status update to `retired` without an audit record is rejected.

---

## 5. Verification Commands

Run catalog unit and PostgreSQL 17 integration tests:

```bash
# Build catalog package
pnpm --filter @tracemigo/catalog build

# Run publication lifecycle and anti-leakage suite on disposable PostgreSQL 17
pnpm test:catalog
```
