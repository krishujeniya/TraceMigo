# ASVS control selection

Pin: **OWASP ASVS 5.0.0**, verified 2026-10-30 against the [official release index](https://asvs.owasp.org/) and release-tagged chapters linked below. IDs follow the version-qualified format. This is a risk-based starting subset; no ASVS level certification is claimed. Brief intent labels are paraphrases; the linked release text is authoritative. Status for all implementation checks: NOT RUN.

Each row inherits the prevention, detection and acceptance scenario of its referenced threat in [the register](threats.md). Delivery-task evidence must eventually demonstrate the full selected requirement, not merely the abbreviated label. [asvs-controls.json](asvs-controls.json) provides machine-readable links.

| Control | Brief intent | Threats | Owner | Delivery tasks |
|---|---|---|---|---|
| [v5.0.0-1.2.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md) | Context-safe response rendering | T07 | ENG | P03.03, P05.03 |
| [v5.0.0-1.2.4](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md) | Parameterized data queries | T02 | ENG | P02.01 |
| [v5.0.0-1.2.5](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md) | Safe OS invocation | T06 | SECURITY | P05.02 |
| [v5.0.0-1.3.6](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md) | Restrict outbound request destinations | T04, T05 | SECURITY | P05.01, P07.02 |
| [v5.0.0-2.2.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md) | Server-validated structures and ranges | T06, T09, T10 | ENG | P01.02, P04.01 |
| [v5.0.0-2.3.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md) | Ordered owner-bound workflow | T04, T09 | ENG | P04.03, P07.01 |
| [v5.0.0-2.3.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md) | Atomic business operation | T08, T10 | FINANCE | P09.03 |
| [v5.0.0-2.3.4](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md) | Concurrent resource reservation | T08, T09 | ENG | P05.04 |
| [v5.0.0-2.4.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md) | Bound automated costly operations | T08 | FINANCE | P00.04, P05.04 |
| [v5.0.0-5.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x14-V5-File-Handling.md) | Document accepted file formats and bounds | T06 | ENG | P04.01 |
| [v5.0.0-5.2.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x14-V5-File-Handling.md) | Bound accepted file size | T06 | ENG | P04.01 |
| [v5.0.0-5.2.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x14-V5-File-Handling.md) | Bound archive expansion before unpacking | T06 | SECURITY | P05.02 |
| [v5.0.0-5.3.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x14-V5-File-Handling.md) | Use trusted paths | T06 | SECURITY | P05.02 |
| [v5.0.0-6.1.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md) | Document every authentication route | T01 | SECURITY | P02.02 |
| [v5.0.0-6.3.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md) | Define multifactor access and documented deviations | T01, T12 | SECURITY | P02.02 |
| [v5.0.0-6.4.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md) | Recovery preserves MFA protection | T01 | SECURITY | P02.02 |
| [v5.0.0-7.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md) | Document inactivity and absolute lifetimes | T01 | SECURITY | P02.02 |
| [v5.0.0-7.2.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md) | Backend session verification | T01 | SECURITY | P02.02 |
| [v5.0.0-7.4.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md) | Invalidate terminated sessions | T01, T14 | SECURITY | P02.02, P09.01 |
| [v5.0.0-7.4.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md) | Disable all sessions on deletion | T14 | PRIVACY | P09.01 |
| [v5.0.0-8.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Document function and object authorization | T02, T12 | SECURITY | P02.02 |
| [v5.0.0-8.1.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Document field authorization | T03 | SECURITY | P02.03 |
| [v5.0.0-8.2.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Explicit function permissions | T04, T12 | SECURITY | P02.02, P07.01 |
| [v5.0.0-8.2.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Explicit object permissions | T02, T13 | SECURITY | P02.02, P09.01 |
| [v5.0.0-8.2.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Explicit field permissions | T03 | SECURITY | P02.03 |
| [v5.0.0-8.3.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Trusted-layer authorization | T04, T09 | ENG | P06.01, P07.01 |
| [v5.0.0-8.4.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) | Cross-tenant controls | T02 | SECURITY | P02.02 |
| [v5.0.0-14.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Classify sensitive assets | T13, T14 | PRIVACY | P09.01 |
| [v5.0.0-14.1.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Specify class protection requirements | T03, T13 | PRIVACY | P09.01 |
| [v5.0.0-14.2.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Prevent sensitive server cache retention | T02, T13 | ENG | P03.03, P09.01 |
| [v5.0.0-14.2.3](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Prevent unintended third-party disclosure | T13 | PRIVACY | P09.02 |
| [v5.0.0-14.2.7](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Automate classified expiry | T13, T14 | PRIVACY | P09.01 |
| [v5.0.0-14.3.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md) | Sensitive browser response no-store | T02, T13 | ENG | P03.03 |

## Applicability and gaps

This subset does not exhaust ASVS. SECURITY must disposition all remaining requirements before P11.04, with evidence-backed applicable/excluded decisions and reviewer names. In particular, frontend cookie/CSRF/CSP, API/streaming protocols, token validation, OAuth/OIDC, encryption/key management, transport, configuration, architecture and security logging require full chapter review as implementations arrive. Their absence here does not waive the project controls in T01–T15.

Authentication strength needs a specific decision: the proposed email fallback and admin-only MFA policy must not be represented as satisfying all ASVS L2 authentication requirements. Document login routes and deviations with compensating controls and independent acceptance. Session timeouts, maximum simultaneous sessions, OIDC logout/revocation behavior and export reauthentication thresholds remain to be specified in P02.02/P09.01.

Sandbox escape, model capability isolation, CI provenance and hidden-assessment contamination need additional project controls beyond this subset: T03–T05, T09, T11–T12 and P00.05/P11.04. Archive-related requirements are conditional on archive support; initial source ingestion should reject archives. A future archive feature requires checks before extraction. No non-applicable or deferred requirement may be marked PASS.
