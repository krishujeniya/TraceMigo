# Web Routing and Public Surface

## Overview
`apps/web/` implements the user-facing web application for TraceMigo, adhering to ADR 0003 for URL routing, access boundaries, and canonical SEO structure.

## Canonical Route Architecture

### 1. Public Indexable Pages
| Path | Purpose | Crawlability |
|---|---|---|
| `/` | Landing page, core proposition, 3-step methodology | Allowed |
| `/catalog` | Complete language track catalog & exercise directory | Allowed |
| `/catalog/:language` | Track-specific catalog (e.g., `/catalog/python`) | Allowed |
| `/cases/:language/:slug` | Public case landing page with difficulty metrics & canonical URL | Allowed |
| `/diagnostic` | 25-minute calibrated benchmark overview and start action | Allowed |
| `/methodology` | Pedagogical framework & 6-dimensional scoring rubric | Allowed |
| `/pricing` | Transparent pricing tiers & cancellation guarantees | Allowed |
| `/privacy` | Data inventory, retention ceilings (30d/7d), user deletion | Allowed |
| `/terms` | Clear service boundaries & acceptable use | Allowed |
| `/login` | Account authentication entry | Allowed |
| `/register` | Account registration & guest warmup progress transfer | Allowed |

### 2. Anonymous Finite Warmup Routes
| Path | Purpose | Limit Behavior |
|---|---|---|
| `/warmup/python/:slug` | Self-contained micro-exercise (prerecorded trace) | Max 3 warmups per session before deep-work/stop choice |

Available warmups:
1. `/warmup/python/running-total`: Loops and conditional branching
2. `/warmup/python/list-references`: In-place mutation vs rebinding
3. `/warmup/python/default-arguments`: Function definition default argument persistence

### 3. Authenticated Private Workspaces (No-Index)
| Path | Purpose | Access Control |
|---|---|---|
| `/workspace/:attemptId` | Interactive learner workspace for active attempts | Requires `tracemigo_session` |
| `/history` | Past attempts, spaced retrieval queue, diagnostic report | Requires `tracemigo_session` |
| `/settings` | Profile, consent declaration, data export, deletion | Requires `tracemigo_session` |
| `/billing` | Subscription management, invoices, quota balances | Requires `tracemigo_session` |
| `/admin/catalog` | Curriculum publication gates & reviewer sign-off | Requires admin session |
| `/admin/appeals` | Dispute resolution & score appeal queue | Requires admin session |

## Crawler Protection & Edge Middleware
- `apps/web/src/middleware.ts` guards all private routes. Unauthenticated requests are redirected with HTTP 307 to `/login?returnTo=...`. Authenticated responses include header `X-Robots-Tag: noindex, nofollow, noarchive`.
- `apps/web/src/app/robots.ts` declares allow rules for public paths and explicitly disallows `/workspace/`, `/history`, `/settings`, `/billing`, `/admin/`, and `/api/`.
- `apps/web/src/app/sitemap.ts` generates canonical entries for indexable pages.

## Legacy Route Redirects
Configured in `apps/web/next.config.mjs`:
- `/practice` -> HTTP 301 to `/catalog`
- `/practice/:language/:slug` -> HTTP 301 to `/cases/:language/:slug`
- `/practice/:attemptId` (UUID) -> HTTP 302 to `/workspace/:attemptId`

## Design Engineering Standards
- **Concentric Radii**: Card inner elements follow `R_inner = R_outer - padding`.
- **Timing**: Micro-interactions use 150–200ms ease-out transitions.
- **Tactile Feedback**: Interactive buttons and cards use `active:scale(0.98)` feedback.
- **Compositor-Only**: Animations target `transform` and `opacity` only.
