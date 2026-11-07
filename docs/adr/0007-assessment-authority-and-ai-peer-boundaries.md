# ADR 0007: Assessment authority and AI peer boundary constraints

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: AI (TraceMigo Cognitive Systems & Peer Policy)
- **Reviewers**: ENG, SECURITY, CONTENT
- **Traceability**: REQ-P-04, REQ-P-05, Audit A15

## Context and Problem Statement

The product includes an interactive AI Peer that converses with learners, asks probing questions, and provides hints. If boundaries are not formally bounded in code and database authority:
1. LLM hallucinations could award incorrect mastery scores or approve invalid learner explanations.
2. The model could be jailbroken or socially engineered to disclose private test cases, hidden bugs, or ground-truth oracle code.
3. The peer could overwhelm learners with excessive hints or unsolicited solutions, damaging comprehension.
4. Operational targets in the initial plan lacked exact query, measurement, and stop definitions.

## Decision

We establish strict separation of authority between **Deterministic Assessment Systems** and the **Advisory AI Peer**, and codify operational target definitions:

### 1. Absolute Separation of Authority
- **Zero Assessment Authority for AI**: The AI model has zero capability or permissions to award points, mark rubrics, certify mastery, or modify user progress records.
- **Relational Authority**: All scoring is executed deterministically by `packages/assessment` and `services/judge-controller` against immutable test fixtures and verified oracle traces.
- **Mastery Ledger Isolation**: Database triggers and RLS policies ensure that user mastery records (`user_concept_mastery`) can only be updated by transactions signed by the deterministic assessment engine, never by peer service tokens.

### 2. AI Peer Operational Contract
The AI Peer is constrained by a deterministic state machine implemented in `packages/peer`:
1. **Prediction Commitment Gate**: The peer is completely silenced during the prediction stage until the learner has submitted their explicit prediction of variable states or control flow.
2. **Turn-Spacing Constraint**: The peer enforces a minimum of two intervening learner reasoning turns between consecutive hint disclosures to prevent rapid hint-spamming.
3. **Question Constraint**: The peer may pose at most one substantive Socratic question per turn.
4. **Context Quarantine**: Sealed assessment cases and private test suites are never included in the peer prompt context.
5. **Prompt Injection Defense**: All user inputs (code, explanations, chat) are treated strictly as data within delimited envelopes; system prompt instructions explicitly forbid overriding evaluation rules or disclosing system instructions.

### 3. Canonical Token-Bucket Evaluation Policy
As established in `audit.md`:
- The canonical token-bucket reference problem **already contains a token capacity cap**.
- Any learner claim asserting that the reference code lacks a token cap must be deterministically rejected by the scoring engine.
- Evaluation rubrics must separately test:
  1. Unsynchronized state transitions and concurrency hazards.
  2. Monotonic clock selection (`time.monotonic()` vs `time.time()`).
  3. Numeric input validation (negative refill rates, fractional capacities).

### 4. Operational SLI/SLO Target Definitions (Resolves Audit A15)
- **Core API Availability**: Target 99.5% per calendar month.
  - Formula: $\frac{\text{Successful eligible requests (HTTP 2xx, 3xx, 4xx except 429)}}{\text{Total eligible requests}} \ge 0.995$.
  - Exclusions: Client authentication failures (401/403) and input validation (422) do not count as downtime. Unexpected 5xx or server timeouts count against the budget.
- **Ordinary API Latency**: Server-side p95 < 300 ms under admitted beta load.
- **Trace Interaction Latency**: p95 < 100 ms for stepping through locally cached execution trace events.
- **Peer First Hint Latency**: p95 < 2.5 s to first substantive hint token.
- **Execution Sandbox Limits**:
  - Source code: $\le$ 128 KiB across $\le$ 10 files.
  - Python runtime: $\le$ 10 CPU seconds, $\le$ 15 wall-clock seconds.
  - Memory: 256 MiB default (512 MiB hard limit).
  - Trace output: $\le$ 10,000 trace events or $\le$ 2 MiB payload.
  - Stdio: $\le$ 64 KiB stdout, $\le$ 64 KiB stderr.

## Consequences

- **Positive**: Eliminates risk of LLM-based grading corruption; prevents prompt injection from leaking solutions; establishes unambiguous, measurable definitions for system reliability and performance.
- **Negative**: Requires rigorous deterministic grading algorithms in code rather than relying on LLM-as-a-judge for subjective free-form explanations.
