# ADR 0008: Data retention, privacy controls, and user deletion lifecycles

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: PRIVACY (TraceMigo Data Governance)
- **Reviewers**: SECURITY, ENG, FINANCE
- **Traceability**: REQ-P-07, REQ-P-10, OPS-09, P09.01

## Context and Problem Statement

TraceMigo processes sensitive user artifacts, including learner code attempts, reasoning explanations, AI peer conversation transcripts, execution traces, diagnostic assessments, and potentially audio snippets (via push-to-talk).

To comply with data privacy regulations (GDPR, CCPA) and uphold student trust:
1. Clear lifecycle retention boundaries must be established so obsolete sensitive artifacts are purged automatically.
2. Users must possess self-service mechanisms to export all personal data and permanently delete their accounts.
3. Raw voice recordings must not be indefinitely stockpiled.
4. Billing and financial transactions must comply with statutory record-keeping requirements without violating user deletion rights.

## Decision

We establish automated lifecycle retention policies, self-service data portability/deletion protocols, and strict voice data constraints:

### 1. Data Classification and Retention Lifecycles
| Data Category | Examples | Retention Limit | Storage Location | Purge Mechanism |
|---|---|---|---|---|
| **Execution Traces** | AST step events, frame variable snapshots | **7 days** | GCS Bucket `tracemigo-traces` | GCS Lifecycle TTL rule (7 days) |
| **Transcripts & Learner Code** | LLM chat turns, draft code submissions | **30 days** post-attempt | PostgreSQL `attempt_transcripts`, `attempt_code` | Automated daily pg_cron cleanup job |
| **Telemetry & Observability** | Clickstream, latency logs, audit spans | **90 days** | Cloud Logging / OpenTelemetry store | Storage sink retention policy |
| **Mastery & Certificates** | Verified concept mastery, badge credentials | **Account lifetime** | PostgreSQL `user_concept_mastery` | Retained until explicit user account deletion |
| **Financial / Billing** | Invoices, Razorpay payment tokens, tax records | **7 years** (statutory legal requirement) | PostgreSQL `billing_invoices` | Immutable financial ledger; anonymized on user deletion |

### 2. Push-to-Talk and Audio Processing Policy
- Push-to-talk audio captured in the browser is streamed to a transient STT worker in volatile memory.
- The returned transcript is presented to the learner in the UI for confirmation or editing.
- **Zero Raw Audio Retention**: Raw audio bytes are discarded immediately upon speech-to-text conversion. Raw audio is never written to persistent disk or cloud object storage.
- External model provider agreements must prohibit retaining audio recordings for model training.

### 3. Self-Service User Export (Data Portability)
- Learners can trigger a "Download My Data" request from `/settings`.
- An asynchronous worker bundles all user attempts, code submissions, mastery records, and transcripts into a password-protected zip file containing structured JSON.
- The download link expires after 24 hours.

### 4. Self-Service Account Deletion (Right to Erasure)
- Learners can initiate account deletion via `/settings`.
- Deletion execution sequence:
  1. Revoke active OIDC sessions and OAuth refresh tokens immediately.
  2. Purge personal identifiers (name, email, avatar, IP addresses) from `users` table.
  3. Hard delete all learner code submissions, transcripts, and attempt notes.
  4. Anonymize financial ledger entries: retain transaction ID and amount for tax compliance, but nullify user identity and personal billing addresses.
  5. Apply tombstone markers to prevent asynchronous cache or replica recovery from restoring deleted users.
  6. Emit deletion events to external third-party providers (analytics, customer support).

## Consequences

- **Positive**: Strict data minimization limits legal liability and breach blast radiuses; predictable storage costs; builds deep user trust through radical privacy transparency.
- **Negative**: Historical code diffs and detailed transcripts are unavailable for long-term retrospective learning analytics past 30 days unless learners explicitly export them.
