# TraceMigo Accountable Ownership and Review Assignments

- **Last Updated**: 2026-11-01
- **Status**: IN_REVIEW — accountable roles confirmed; reviewer assignment/acceptance pending
- **Traceability**: P00.02, `planning/tracker.md` Section 3

This document defines role responsibilities and proposed reviewer qualifications. The job titles below are not assigned people or evidence of acceptance. Named owners, reviewers, scope and acceptance dates belong in the approved private planning handoff. Every task and release gate still requires the corresponding actual acceptance.

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
2. **Release Sign-Off (Gates G00–G12)**: Release gates cannot be approved by a single person. Production promotion requires joint approval across PRODUCT, ENG, OPS, and SECURITY.
3. **Escalation Path**: Any unresolved conflict between security/privacy controls and product velocity must be formally escalated to the Lead Product Architect and Security Architect for an ADR amendment.


## Current assignment state

The user explicitly assigned all nine operational accountabilities to the sole individual project owner on 2026-11-01. The approved private ownership record contains the name and role scopes. India/US remain the launch markets. Role ownership does not prove completed implementation, domain control, specialist review or release acceptance.

The private P00.02 handoff contains a nine-role nomination and acceptance register. A normal clone does not include that ignored planning record; request its approved handoff when needed. Record the role's named accountable person, named reviewer, accepted scope, date and evidence. Preserve independent content/security review and joint release-signoff requirements. All nine accountable assignments are now confirmed. Named reviewer assignments and actual task/release acceptance remain pending.

P00.02 remains IN_REVIEW pending the remaining reviewer assignment and acceptance evidence. Local ADR and implementation evidence remains valid for its stated scope.
