# ADR 0003: URL routing, access boundaries, and canonical structure

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: ENG (TraceMigo Core Architecture)
- **Reviewers**: PRODUCT, DESIGN, SECURITY
- **Traceability**: REQ-P-04, REQ-B-01, Audit A08

## Context and Problem Statement

The initial specifications contained conflicting URL path proposals:
1. `plan.md` proposed `/practice/:attemptId` for active learning sessions.
2. `TraceMigo_Brand_Research.md` and marketing notes proposed `/practice/python/token-bucket/` as a public case landing page and `/practice/` as the public catalog.
3. This resulted in route collisions between static slugs and dynamic attempt IDs, and risked indexing private learner attempts or leaking authenticated endpoints to search crawlers.

## Decision

We establish an unambiguous route hierarchy separating **Public Indexable Pages**, **Anonymous Finite Warmups**, **Authenticated Private Workspaces**, and **Internal Review Tools**:

### 1. Public Indexable Routes (SEO & Marketing)
- `/`: Home landing page, core proposition, and evidence-first methodology.
- `/catalog`: Complete language tracks and curriculum directory.
- `/catalog/:language`: Track-specific catalog (e.g., `/catalog/python`).
- `/cases/:language/:slug`: Public case overview and difficulty details (e.g., `/cases/python/token-bucket`). Serves canonical link tags, OpenGraph metadata, and structured schema data.
- `/methodology`: Pedagogical framework, evidence basis, and scoring rubric transparency.
- `/pricing`: Transparent pricing, subscription tiers, and quota limits.
- `/privacy`, `/terms`: Legal, consent, and retention policies.

### 2. Anonymous Warmup Routes
- `/warmup/:language/:slug`: Finite anonymous micro-exercise (max 3 cards per session before registration prompt; stored in client sessionStorage; no server attempt record created).

### 3. Authenticated Learning Workspace Routes (No-Index)
- `/workspace/:attemptId`: Stateful interactive learner workspace for an active attempt (prediction input, trace replay, claim submission, peer panel, and diff patch editor).
- `/history`: Learner attempt history, diagnostic reports, and spaced-retrieval review queue.
- `/settings`: Consent management, profile, data export, and account deletion.
- `/billing`: Subscription management, quota balances, invoices, and checkout.

### 4. Admin & Reviewer Routes
- `/admin/catalog`: Content authoring, provenance checks, and two-review publication gates.
- `/admin/appeals`: Queue for contested scoring and alternative hypothesis review.

### 5. Crawler Protection and Canonical Rules
- `robots.txt` explicitly disallows `/workspace/*`, `/api/*`, `/admin/*`, and `/settings/*`.
- Authenticated responses set `X-Robots-Tag: noindex, nofollow, noarchive`.
- Canonical `<link rel="canonical">` tags on case overviews point strictly to `https://tracemigo.com/cases/:language/:slug`.

### 6. Legacy Route Redirects
- `/practice` -> HTTP 301 to `/catalog`.
- `/practice/:language/:slug` -> HTTP 301 to `/cases/:language/:slug`.
- `/practice/:attemptId` (UUID pattern) -> HTTP 302 to `/workspace/:attemptId`.

## Consequences

- **Positive**: Zero collision risk between slugs and UUIDs; clean boundary for search engines; clear security and authorization boundaries at the reverse proxy/edge layer.
- **Negative**: Internal documentation and links must strictly use `/workspace/:attemptId` for attempts and `/cases/...` for public landing pages.
