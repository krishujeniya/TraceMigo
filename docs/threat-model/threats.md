# Threat and abuse-case register

Status for every scenario: NOT RUN. Residual risk: OPEN. No risk accepted. Machine-readable source: [threats.json](threats.json). Runtime scenarios must run in the environments specified by delivery tasks; hostile code runs only in the disposable isolated judge plane.

## T01: Account takeover or recovery bypass

- Boundary: F01, F02; assets: A03, A04; severity: High.
- Owner role: SECURITY; delivery tasks: P02.02.
- Prevention: Validate OIDC callback and recovery; secure cookies, CSRF, admin MFA, recent authentication and session revocation.
- Detection: Alert on callback/recovery failures and revoked-session reuse.
- Acceptance scenario: Replay callback, wrong issuer/audience/nonce, forged origin and revoked session must fail; valid owner login succeeds.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T02: Tenant or owner escape through child records, streams, caches or signed URLs

- Boundary: F03; assets: A03, A05, A07; severity: Critical.
- Owner role: SECURITY; delivery tasks: P02.01, P02.02.
- Prevention: FORCE RLS with deployed nonowner roles; server membership; per-object checks; transaction-local pool context.
- Detection: Audit denied object access and membership changes without content.
- Acceptance scenario: Two users in one tenant and another tenant cannot read/write child objects or replay streams; reused pool connection has no previous context.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T03: Answer leakage through API, peer context, exports or build artifacts

- Boundary: F03, F04, F06, F12; assets: A02, A12; severity: Critical.
- Owner role: CONTENT; delivery tasks: P02.03, P07.02, P10.01.
- Prevention: Separate authorities table/pool/IAM; allowlisted public projection; sealed-family derivation quarantine.
- Detection: Restricted-access alerts and synthetic canary leak scan in public artifacts.
- Acceptance scenario: App and peer credentials fail direct SQL/storage reads; canary private keys, filenames and oracle strings absent from browser bundles, prompts and exports.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T04: Prompt injection turns peer into scorer, disclosure tool or network proxy

- Boundary: F04; assets: A02, A07, A09; severity: Critical.
- Owner role: AI; delivery tasks: P07.01, P07.02, P07.03.
- Prevention: Capability-limited gateway; no score/billing/runner writes; trusted mode/stage checks; no arbitrary provider URLs.
- Detection: Record policy denials and evaluation leak rates with sanitized IDs.
- Acceptance scenario: Injected comments and model tool calls cannot reveal oracle, change mastery, bypass prediction or dispatch execution; valid permitted hint works.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T05: Hostile Python escapes sandbox or reaches credentials and network

- Boundary: F07; assets: A02, A04, A13; severity: Critical.
- Owner role: SECURITY; delivery tasks: P00.05, P05.01, P05.02, P05.05.
- Prevention: Fresh gVisor Job; separate project/network; nonroot read-only root; no service token; drop capabilities; effective metadata/IPv4/IPv6 egress denial.
- Detection: Alert on admission denial, network probes and anomalous runtime activity; emergency stop.
- Acceptance scenario: In disposable isolated plane prove network/metadata/host mount denial, absent workload credentials, resource limits and cleanup; incompatible security settings block release.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T06: Traversal, decompression bomb or malformed source compromises preparation

- Boundary: F01, F07; assets: A05, A06; severity: High.
- Owner role: ENG; delivery tasks: P04.01, P05.02.
- Prevention: Python source allowlist; normalized relative paths; reject symlinks, binaries and archives unless explicitly supported; bound before allocation.
- Detection: Count parser rejection and storage/CPU anomalies.
- Acceptance scenario: Reject traversal, absolute paths, symlinks, over 10 files or 128 KiB; trusted process never imports or analyzes hostile code unsandboxed.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T07: Malicious trace or output executes script or methods during display

- Boundary: F01, F08; assets: A05, A06; severity: High.
- Owner role: ENG; delivery tasks: P05.03, P03.03.
- Prevention: Bound trace schema and primitives; no arbitrary repr/getters; safe text/Markdown rendering and URL protocols.
- Detection: Track truncation/schema errors; browser CSP reports without learner text.
- Acceptance scenario: Trace with script payload stays inert; malicious repr is not invoked; over 10k events/2 MiB and stdout/stderr over 64 KiB each truncate visibly.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T08: Concurrent requests exhaust execution/provider spend or bypass quotas

- Boundary: F05, F07; assets: A08, A12; severity: High.
- Owner role: FINANCE; delivery tasks: P00.04, P05.04, P09.03.
- Prevention: Transactional reservations before outbox; global/tenant/user budgets; bounded retries, queue and active counts; shutdown owner.
- Detection: Spend/reservation reconciliation and queue-age alerts.
- Acceptance scenario: Race duplicate and distinct requests against exhausted budget; accepted operation charges once, others reject; missing budget store prevents paid dispatch.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T09: Forged runner success, stale leases or late completion corrupts score

- Boundary: F05, F08; assets: A06, A07; severity: High.
- Owner role: ENG; delivery tasks: P04.03, P05.04, P06.01.
- Prevention: External oracle; authenticated results; job/submission/version hashes; lease fencing; frozen finalization and immutable corrections.
- Detection: Audit stale completion and evidence mismatch.
- Acceptance scenario: Forged passed flag does not score; old epoch, wrong hash and cancelled/finalized result cannot overwrite accepted state; duplicate completion harmless.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T10: Forged, replayed or reordered payment events mint entitlements

- Boundary: F09; assets: A08; severity: High.
- Owner role: FINANCE; delivery tasks: P09.03.
- Prevention: Raw-body signature before processing; provider event dedup; server price/currency; atomic ledger and reconciliation.
- Detection: Alert on signature failures, duplicate credits and reconciliation drift.
- Acceptance scenario: Invalid/tampered body makes no change; duplicate/out-of-order events and concurrent refunds do not duplicate credit; redirect alone never activates payment.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T11: Dependency or PR steals credentials or promotes attacker artifact

- Boundary: F11; assets: A04, A12; severity: Critical.
- Owner role: OPS; delivery tasks: P01.03, P01.04, P11.05.
- Prevention: Secretless fork checks; pinned dependency/action/image revisions; protected build; scoped OIDC; digest attestation and environment approval.
- Detection: Secret/leak scan and failed OIDC/attestation alerts.
- Acceptance scenario: Malicious fork/ref cannot obtain privileged identity; seeded synthetic secret/private canary fails checks; wrong digest cannot deploy.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T12: Insider self-publishes answers or abuses reviewer assignment

- Boundary: F12; assets: A02, A07; severity: Critical.
- Owner role: CONTENT; delivery tasks: P02.03, P06.03, P10.01.
- Prevention: Admin MFA and scoped case/result assignments; two distinct reviews; immutable versions and audited appeal revisions.
- Detection: Audit grant/publication changes and self-review attempts.
- Acceptance scenario: Same reviewer twice cannot publish; tenant admin cannot read transcript; retired version cannot be overwritten; revocation removes reviewer access.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T13: Personal code/audio leaks through provider, export, logs or cache

- Boundary: F04, F10, F13; assets: A05, A09, A10, A11; severity: High.
- Owner role: PRIVACY; delivery tasks: P09.01, P09.02.
- Prevention: Minimize provider context; consent; no default audio persistence; owner-bound expiring exports; redaction/no-store.
- Detection: Purge backlog, export access and synthetic sensitive-marker scans.
- Acceptance scenario: Foreign/expired export denied; markers absent from logs/provider context unless expressly allowed; provider retention settings and deletion verified.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T14: Restore or delayed job resurrects deleted user and records

- Boundary: F05, F10, F13; assets: A03, A05, A13; severity: High.
- Owner role: PRIVACY; delivery tasks: P09.01, P11.02.
- Prevention: Session revoke; idempotent purge; deletion-generation fencing; tombstones replayed before serving restored data.
- Detection: Per-store deletion acknowledgments and restore/purge failures.
- Acceptance scenario: Delete with in-flight job then restore backup; late completion and retry cannot recreate records; retained billing exception documented without false full-erasure claim.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

## T15: Secret-bearing errors, missing audit evidence or provider outage hide compromise

- Boundary: F03, F13; assets: A04, A05, A12; severity: High.
- Owner role: OPS; delivery tasks: P01.02, P11.03, P11.04.
- Prevention: Fail-closed config; generic client errors; redacted restricted audit; named response coverage; solo/prerecorded degradation labeled.
- Detection: Synthetic secret probes, missing-telemetry and outage alerts.
- Acceptance scenario: Invalid production adapter/config stops startup; stack trace has no secret; outage saves reasoning and never reports fabricated execution or score.
- Evidence: NOT RUN; residual risk OPEN pending delivery and independent review.

