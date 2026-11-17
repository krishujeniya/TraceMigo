# Learning Engine, Attempt State Machine, and Idempotency Transactions

P03.03, 2026-11-07. Implements `@tracemigo/learning`, authoritative attempt event schemas in `content/schemas/attempt.event.v1.json`, idempotency response schemas in `content/schemas/idempotency.response.v1.json`, the multi-stage learner progression lifecycle, optimistic concurrency ratchet, immutable event log, and SSE replay engine.

---

## 1. Architectural Scope and Design Invariants

`@tracemigo/learning` manages the learner execution lifecycle, attempt state progression, and deterministic recovery. It enforces:

| Control | Specification | Invariant |
|---|---|---|
| **Optimistic Revision Ratchet** | `app.guard_attempt_revision()` | Every state transition, autosave, pause, resume, disclosure, and submission requires `expectedRevision` matching current revision. The database trigger strictly requires `NEW.revision = OLD.revision + 1`. |
| **Attempt Identity Immutability** | `app.guard_attempt_revision()` | The tuple `(id, tenant_id, user_id, problem_version_id, prior_attempt_id, context_source, started_at)` is immutable once inserted. Modifying identity triggers SQL error 23514. |
| **Immutable Event & Submission Log** | `app.events_immutable`, `app.submissions_immutable` | `app.attempt_events` and `app.submissions` are append-only. UPDATE and DELETE operations are rejected by database triggers with SQL error 23514. |
| **Stage Progression State Machine** | Stage Transition Gate | Attempts must follow deterministic order: `warmup` &rarr; `predict` &rarr; `trace` &rarr; `explain` &rarr; `mutate` &rarr; `review`. Skipping stages or backward transitions raises `InvalidStageTransitionError`. |
| **Solo Mock Integrity** | `mock_solo` Mode Check | In `mock_solo` mode, requesting hints or disclosures is forbidden and raises `SoloMockDisclosureError`. |
| **Idempotency Immutability** | `ops.guard_idempotency_update()` | Operations run through `executeIdempotentOperation` record request hashes in `ops.idempotency_records`. Re-execution with an identical payload returns cached output. Differing payloads raise `IdempotencyConflictError`. Completed idempotency records are immutable. |

---

## 2. Envelope Schemas (`content/schemas/`)

Authoritative JSON schemas define attempt events and idempotency envelopes:

- `content/schemas/attempt.event.v1.json`: Envelope schema matching PostgreSQL `app.valid_envelope(payload, 'attempt.event.v1')`. Contains `event_type`, ISO timestamp, optional `stage`, and structured `details`.
- `content/schemas/idempotency.response.v1.json`: Envelope schema matching PostgreSQL `app.valid_envelope(response, 'idempotency.response.v1')`. Stores execution `status` and `body`.

---

## 3. Attempt Progression Lifecycle

Learner progress flows through six atomic stages:

```
+------------+        +------------+        +------------+
|   WARMUP   | -----> |  PREDICT   | -----> |   TRACE    |
+------------+        +------------+        +------------+
                                                  |
                                                  v
+------------+        +------------+        +------------+
|   REVIEW   | <----- |   MUTATE   | <----- |  EXPLAIN   |
+------------+        +------------+        +------------+
```

### Supported Transitions
- `warmup` &rarr; `predict`: Initial conceptual baseline verified.
- `predict` &rarr; `trace`: Learner predicts execution output before running debugger.
- `trace` &rarr; `explain`: Step-by-step state inspection completed.
- `explain` &rarr; `mutate` or `review`: Learner writes hypotheses and explanations.
- `mutate` &rarr; `review`: Code invariants or test mutations verified.
- `review`: Terminal stage prior to final submission.

---

## 4. Concurrency Control and Event Logging

### Revision Ratchet
To protect against split-brain execution across multiple tabs or network retries, all modifying APIs accept `expectedRevision`:

```typescript
const attempt = await advanceStage(tx, {
  tenantId,
  userId,
  attemptId,
  expectedRevision: 3,
  toStage: 'explain',
});
// attempt.revision is now 4
```

If another client has already advanced the revision, a `ConcurrentModificationError` (HTTP 409) is thrown.

### Event Sourcing and SSE Streaming
Every action appends a monotonic event row to `app.attempt_events`:
- `attempt_created` (seq 1)
- `stage_advanced`
- `claim_autosaved`
- `attempt_paused`
- `attempt_resumed`
- `disclosure_requested`
- `attempt_submitted`

Clients reconnecting after network interruption use `replayEvents(tx, tenantId, userId, attemptId, fromSeq)` to stream missed events via Server-Sent Events formatted with `formatSSEMessage()`.

---

## 5. Verification Commands

Run the comprehensive learning test suite:

```bash
pnpm test:learning
```
