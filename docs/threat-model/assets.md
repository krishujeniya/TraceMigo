# Assets and handling rules

Classes: Public = approved projection only; Internal = restricted engineering metadata; Confidential = personal or tenant data; Restricted = secrets or assessment authority. All nonpublic transfers require authenticated encrypted transport and least-privilege storage access. Cloud storage/database/backup encryption and key permissions must be tested. All retention values below are design targets, not deployed policies.

| ID | Asset / class | Permitted readers and writers | Retention and protection |
|---|---|---|---|
| A01 | Published catalog, starter code / Public | Public approved readers; restricted publication service writes | Immutable hash/version and provenance; no hidden metadata; quarantine withdrawn content |
| A02 | Private oracle, hidden schedules, sealed families, answer-bearing keys / Restricted | Controller and explicitly assigned author/review paths; API/peer/runner denied | Retain immutable authority for governed historical review; retirement/access policy requires CONTENT acceptance; never log contents |
| A03 | Membership, profile, OIDC identifiers / Confidential | Owner and scoped identity/privacy services | Account lifetime then deletion; minimize abuse identifiers; resolve processor deletion and backup expiry before launch |
| A04 | Session, OAuth, provider, webhook and signing secrets / Restricted | Dedicated service identity only; recent-auth account operations | Secret manager, rotation/revocation; never browser JS, URL, repo, prompt, runner or logs |
| A05 | Attempt code, explanations, confirmed transcripts / Confidential | Owner; assigned reviewer only through restricted path | Code/transcript target 30 days; no general telemetry copy; opt-in journal separate; private no-store responses |
| A06 | Trace variables and stdio / Confidential, hostile | Owner and bounded controller/assessment | Target 7 days; escape display; bounded serialization and redaction; prevent hidden fixture output leakage |
| A07 | Scores, mastery, appeals and evidence revisions / Confidential | Owner reads; deterministic assessment writes; assigned appeals review | Mastery account lifetime; immutable score revisions; historical evidence retention must reconcile with A05/A06 expiry |
| A08 | Billing events, entitlements, refunds / Confidential | Owner view, billing service and authorized finance | Reviewed jurisdiction/provider-specific retention pending; ADR 0008 seven-year statement is unverified; preserve only required fields |
| A09 | Audio and model-provider context / Confidential | Consenting owner, bounded speech/model adapter | No application raw-audio persistence by default; confirmed text A05; external retention/training terms require account-specific verification |
| A10 | Export archives and signed URLs / Confidential | Request owner and privacy worker | Link target at most 24h; archive expiry/purge must be set explicitly; revoke on deletion; no tokens in analytics or access logs |
| A11 | Logs, audit records, coarse abuse IDs / Internal or Confidential | OPS/SECURITY scoped access; services write redacted events | Detailed events target 90 days; security audit retention separately justified; hashing IP does not remove sensitivity |
| A12 | Build artifacts, SBOM, source and deployment identity / Internal or Restricted | Secretless PR checks; protected trusted build/release identities | Digest provenance, dependency locks and access reviews; no private content in web bundles or public evidence |
| A13 | Backups, deletion tombstones and restore manifests / Restricted | Isolated OPS/privacy recovery identities | Backup expiry and tombstone lifetime must cover restore horizon; restore cannot reintroduce erased data; timed drill required |

Anonymous warmup sessionStorage holds nonpersonal progress only. Confirmed learner content and bearer tokens must not be copied into analytics, public caches, search indexes, client error trackers, or unrestricted support exports. Aggregate metrics require reidentification review before being treated as nonpersonal.
