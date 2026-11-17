# TraceMigo Accountable Ownership and Review Assignments

- **Last Updated**: 2026-11-07
- **Status**: IN_REVIEW — accountable roles confirmed; reviewer assignment/acceptance pending
- **Traceability**: P00.02, N01, `planning/tracker.md` Section 3

This document defines role responsibilities and proposed reviewer qualifications. The job titles below define functional accountability domains. Named owner, reviewer assignments, scope and acceptance dates are maintained in the approved private planning handoff. Every task and release gate still requires the corresponding actual acceptance.

## Domain Roles and Accountabilities

| Role | Domain Scope | Primary Accountability | Proposed Reviewer Qualification |
|---|---|---|---|
| **PRODUCT** | Scope, learner validation, truthful claims, launch decision | Core value proposition, public positioning, feature scoping, Go/No-Go launch decisions. | Lead Product Architect |
| **ENG** | Application architecture, data contracts, migrations, code correctness | Fullstack web monolith, database schemas, API contracts, judge service implementation. | Principal Software Engineer |
| **OPS** | Cloud infrastructure, CI/CD pipelines, observability, disaster recovery | GCP environment provisioning, Terraform modules, GKE cluster policies, incident rotation. | Lead DevOps / SRE Engineer |
| **SECURITY** | Threat modeling, sandboxing, vulnerability response, penetration testing | ASVS compliance, gVisor isolation verification, OIDC token validation, secret rotation. | Security Architect / AppSec Lead |
| **CONTENT** | Curriculum authoring, reference oracles, rubric calibration, two-review publication | Python practice problems, token-bucket reference oracle, regression witnesses, sealed assessment cases. | Curriculum Director & Peer Content Reviewer |
| **AI** | Cognitive peer policy, model evaluations, prompt engineering, hint safety | Peer state machine, prompt injection defenses, eval suite execution, provider latency monitoring. | Applied AI / NLP Specialist |
| **DESIGN** | Design tokens, typography, visual brand assets, accessibility (WCAG AA) | SVG vector identity, theme tokens (Manrope, dark/light contrast), responsive UI layouts, screen-reader semantics. | Staff Product Designer |
| **PRIVACY** | Data minimization, GDPR/CCPA compliance, consent, export/deletion | Data inventory, retention lifecycles, user deletion tombstones, push-to-talk transient audio policy. | Data Protection Officer / Legal Specialist |
| **FINANCE** | Unit economics, cloud spend caps, payment gateways, ledger reconciliation | Cloud capacity cost modeling, Razorpay merchant onboarding, refund handling, subscription lifecycle. | Financial Controller / FinOps Lead |

## Review & Approval Protocol

1. **Two-Review Publication Gate (Content)**: Every problem published to the public catalog or sealed assessment pool requires independent review and cryptographic sign-off from two distinct reviewers (Content Author + Independent Content Reviewer).
2. **Release Sign-Off (Gates G00–G12)**: Release gates cannot be approved on self-attestation alone. Under the confirmed solo-owner model where Krish Ujeniya holds primary accountability across all nine domains, production promotion requires recorded approval covering PRODUCT, ENG, OPS, and SECURITY, supported by separately identifiable independent specialist review evidence (e.g. independent AppSec review for sandboxing/data flows and independent content evaluation). The multi-person verification requirement is preserved in substance; contractor or external reviewer participation provides independent assurance without transferring project ownership. Proposed refinements to this protocol are tracked in ADR 0009.
3. **Escalation Path**: Any unresolved conflict between security/privacy controls and product velocity must be formally escalated to the Lead Product Architect and Security Architect for an ADR amendment.

## Current assignment state

The user explicitly assigned all nine operational accountabilities to the sole individual project owner, Krish Ujeniya, on 2026-11-01. The approved private ownership record contains the confirmed name and role scopes. India and the United States remain the launch markets. Role ownership establishes accountability; it does not prove completed implementation, domain control, specialist review, or release acceptance.

The private P00.02 handoff contains a nine-role nomination and acceptance register. A normal clone does not include that ignored planning record; request its approved handoff when needed. The register records the role's named accountable person, designated reviewer, accepted scope, date, and evidence. All nine accountable role assignments are confirmed with Krish Ujeniya. Named reviewer assignments and actual task/release acceptance remain pending.

P00.02 remains IN_REVIEW pending the remaining reviewer assignment and acceptance evidence. Local ADR and implementation evidence remains valid for its stated scope.
