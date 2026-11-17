# ADR 0009: Proposed architecture amendments for governance, security claims, origin, retention, and SLOs

- **Status**: PROPOSED
- **Date**: 2026-11-07
- **Accountable Owner**: ENG / SECURITY (Krish Ujeniya)
- **Proposed Reviewers**: PRODUCT, ENG, OPS, SECURITY, CONTENT, PRIVACY, FINANCE
- **Traceability**: Findings F02, F03, F04, F05, F06, F07, F15; Task N01; `planning/tracker.md` Section 11

## Context and Problem Statement

A thorough documentation audit conducted in November 2026 identified several inconsistencies and overstatements in the baseline Architecture Decision Records (ADR 0001–0008) and `docs/ownership.md`:
1. **F02**: ADR headers marked "ACCEPTED" conflate internal drafting/specification baseline with verified independent reviewer sign-off.
2. **F03**: `docs/ownership.md` required release sign-off across four distinct people, which conflicts with Krish Ujeniya operating as the confirmed sole accountable individual owner across all nine project domains.
3. **F04**: ADR 0005 and ADR 0007 claimed absolute security outcomes ("mathematical proof of access denial", "complete elimination of injection and grading risks") that exceed testable engineering reality and contradict threat review R01.
4. **F05**: ADR 0003 hardcoded `https://tracemigo.com` as the canonical origin before trademark clearance, domain registration, or DNS control was verified.
5. **F06**: ADR 0008 stated fixed seven-year financial retention and zero-retention raw audio without country-specific statutory legal basis (India/US) or verified provider contracts.
6. **F07**: ADR 0007 defined a 99.5% availability objective with an ambiguous denominator that included most 4xx responses while leaving entitled throttling (429) unclassified.
7. **F15**: ADR 0002 and ADR 0004 context narratives referenced exploratory planning SQL enums and dimensions that diverge from the actual agreed schema migrations.

This ADR proposes formal amendments to resolve these findings while preserving the historical record of the original decisions.

---

## Proposed Amendments

### Amendment 1: Architecture Decision Acceptance Protocol (Resolves F02)

- **Prior Decision**: ADRs 0001–0008 were authored and marked ACCEPTED as the foundational architecture baseline.
- **Proposed Change**:
  We formalize a two-phase architecture acceptance model:
  1. *Specification Baseline*: An ADR authored and signed off by the Accountable Owner (Krish Ujeniya) establishes the binding technical specification for implementation tasks.
  2. *Verified Review Acceptance*: Closing parent roadmap review tasks (P00.02, P00.03, P00.04) and production release gates (G00–G12) requires an explicit, named independent reviewer record, credentials, evaluated scope, review date, and signed review evidence. An ADR status header alone does not certify external reviewer sign-off.
- **Trade-offs / Consequences**: Establishes rigorous governance and prevents self-certification from being mistaken for independent external audit.
- **Affected Tasks**: P00.02, P00.03, P00.04, G00–G12.
- **Required Reviewers & Evidence**: Principal Software Engineer and AppSec Lead independent review records.

---

### Amendment 2: Solo Ownership and Independent Verification Protocol (Resolves F03)

- **Prior Decision**: `docs/ownership.md` stated that release gates cannot be approved by a single person, assuming four separate internal executive leads (PRODUCT, ENG, OPS, SECURITY).
- **Proposed Change**:
  Reconcile the solo-owner structure with strict release verification:
  1. Krish Ujeniya is the confirmed sole individual owner accountable across all nine project roles (PRODUCT, ENG, OPS, SECURITY, CONTENT, AI, DESIGN, PRIVACY, FINANCE).
  2. Production release gates (G00–G12) cannot be approved on self-attestation alone. Promotion requires recorded sign-off across the four core disciplines (PRODUCT, ENG, OPS, SECURITY) accompanied by verifiable, independent specialist review artifacts (e.g. independent Content Reviewer sign-off for curriculum/sealed cases; external AppSec review for sandbox isolation and data flows).
  3. External contractors or specialists provide independent assurance without acquiring equity, IP ownership, or project governance rights.
- **Trade-offs / Consequences**: Allows solo-founder velocity while preserving the integrity of multi-discipline release gates.
- **Affected Tasks**: P00.02, P10.01, P11.04, G00–G12.
- **Required Reviewers & Evidence**: Lead Product Architect and Security Architect independent review sign-off.

---

### Amendment 3: Bounded Security Defenses and Residual Risk Scope (Resolves F04, Amends ADR 0005 & 0007)

- **Prior Decision**: ADR 0005 claimed "Complete architectural defense against ground-truth leakage" and "audits can mathematically prove access denial." ADR 0007 claimed "Eliminates risk of LLM-based grading corruption; prevents prompt injection from leaking solutions."
- **Proposed Change**:
  Replace absolute claims with bounded defense-in-depth statements:
  1. Database table splitting (`problem_versions` vs `problem_authorities`), privilege isolation (`tracemigo_app_role` denying access to authorities), and IAM bucket isolation prevent *direct* queries and inadvertent API serialization leaks from web/API application containers.
  2. Residual risks are explicitly recognized: judge controller compromise, timing/side-channel analysis, container breakout, and iterative prompt extraction via multi-turn advisory peer dialogue remain real threat vectors.
  3. Deterministic scoring isolates grading from LLM hallucinations, but rubric correctness and prompt boundary integrity depend on ongoing audit logging and negative test harnesses, not mathematical proofs.
- **Trade-offs / Consequences**: Aligns documentation with NIST SSDF SP 800-218 and OWASP ASVS v5.0.0; eliminates speculative claims of absolute security.
- **Affected Tasks**: P00.03, P05.01, P05.02, P07.01, P11.04.
- **Required Reviewers & Evidence**: Independent AppSec / Penetration Testing Specialist review.

---

### Amendment 4: Configurable Verified Canonical Origin (Resolves F05, Amends ADR 0003)

- **Prior Decision**: ADR 0003 hardcoded `https://tracemigo.com/cases/:language/:slug` as the canonical origin.
- **Proposed Change**:
  1. The canonical URL origin must be environment-configurable via `APP_CANONICAL_ORIGIN`.
  2. No production canonical headers, sitemaps, OpenGraph metadata, or Schema.org `sameAs` arrays may claim `https://tracemigo.com` until P10.03 and P12.03 deliver verified domain registrar checkout, DNS ownership, and SSL certificate binding.
  3. Pre-release environments, local test servers, and preview deployments must emit `X-Robots-Tag: noindex, nofollow, noarchive` and use relative or non-production origin identifiers.
- **Trade-offs / Consequences**: Prevents search engine canonical conflicts and crawler misattribution during pre-launch phases.
- **Affected Tasks**: P03.01, P10.03, P12.03.
- **Required Reviewers & Evidence**: Lead Product Architect and Technical SEO Specialist.

---

### Amendment 5: Data Retention Policy Qualifications and Provider Verification (Resolves F06, Amends ADR 0008)

- **Prior Decision**: ADR 0008 mandated a 7-year statutory financial retention, 30-day attempt code purge, and zero raw-audio persistence as fixed statutory policies.
- **Proposed Change**:
  1. Qualify the 7-year financial retention as a proposed baseline requiring validation under Indian statutory laws (Companies Act 2013, Income Tax Act, GST rules) and US federal/state commercial record laws.
  2. Reconcile the 30-day code purge with contested scoring appeals (P06.03): retain cryptographic decision summaries and content hashes rather than raw student code.
  3. Push-to-talk voice functionality remains strictly disabled until model provider enterprise agreements (OpenAI/Google) are formally verified to guarantee zero raw audio retention and zero training on student voice inputs.
- **Trade-offs / Consequences**: Ensures compliance with GDPR, India's DPDP Act 2023, and CCPA; grounds data lifecycle policies in validated legal requirements.
- **Affected Tasks**: P00.03, P08.01, P09.01, P09.02.
- **Required Reviewers & Evidence**: Legal / Privacy Specialist and Financial Controller.

---

### Amendment 6: Deterministic SLI Classification and Availability Targets (Resolves F07, Amends ADR 0007)

- **Prior Decision**: ADR 0007 defined a 99.5% availability objective with an ambiguous formula that included most 4xx status codes.
- **Proposed Change**:
  Adopt an explicit request outcome classification matrix for core API availability:
  - **Good (Successful)**: HTTP 2xx (Success), HTTP 3xx (Valid redirects).
  - **Excluded (Client-Side Fault / Non-System Outage)**: HTTP 400 (Bad Request), 401 (Unauthenticated), 403 (Forbidden), 404 (Not Found), 405 (Method Not Allowed), 422 (Validation Error), and legitimate rate limiting (429) against unauthenticated or abusive callers.
  - **Bad (System Failure / Downtime)**: HTTP 5xx (Internal Server Errors, Bad Gateway, Service Unavailable), HTTP 408 / 504 (Server-side timeouts), unexpected HTTP 429 returned to an authenticated user with valid remaining quota (entitled throttling), unhandled runtime process crashes, and telemetry ingestion loss during active incidents.
  - **Availability Target**:
    $$\text{SLI} = \frac{\text{Good Requests}}{\text{Good Requests} + \text{Bad Requests}} \ge 0.995$$
  - The 99.5% figure is explicitly recognized as an operational design target for monitoring and alerting, not a contractual or measured SLA.
- **Trade-offs / Consequences**: Eliminates distortion of error budgets by invalid client traffic while properly accounting for false throttles and backend failures.
- **Affected Tasks**: P00.03, P01.02, P11.01.
- **Required Reviewers & Evidence**: Lead DevOps / SRE Engineer and Security Architect.

---

### Amendment 7: Clarification of Historical Schema Examples vs Binding Contracts (Resolves F15, Amends ADR 0002 & 0004 Context)

- **Prior Decision**: ADR 0002 and ADR 0004 context sections referenced exploratory planning SQL enums (`orient/investigate/analyze/refactor`) and variable vector dimensions (768 vs 1536).
- **Proposed Change**:
  Clarify that early exploratory SQL snippets were illustrative sketches superseded by formal architecture decisions:
  - The binding attempt mode enum is strictly: `'practice'`, `'mock_solo'`, `'mock_ai'`.
  - The binding attempt stage enum is strictly: `'warmup'`, `'predict'`, `'trace'`, `'explain'`, `'mutate'`, `'review'`.
  - Vector search is strictly excluded from initial database bootstrap migrations (`packages/db/migrations/core/`) and deferred to optional post-launch extensions. Applied PostgreSQL migrations remain unchanged.
- **Trade-offs / Consequences**: Resolves discrepancies between initial brainstorming documentation and authoritative migration schemas.
- **Affected Tasks**: P02.01, P04.01.
- **Required Reviewers & Evidence**: Principal Software Engineer.
