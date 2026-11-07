# Review scope, residual risk and next actions

Status: IN_REVIEW. Builder: Codex, 2026-10-30. Independent security reviewer: **unassigned**. Named accountable SECURITY/PRODUCT acceptance: **pending**. Existing ownership entries identify job titles, not people. The tracker records P00.02 as DONE; this task preserves that historical status without treating it as proof of named acceptance or enforced controls.

## Findings from current files

| ID | Observation | Required action / owner | Release effect |
|---|---|---|---|
| R01 | ADR 0005 claims complete leakage defense/mathematical proof; ADR 0007 claims elimination of injection and grading risks | SECURITY/ENG qualify these claims during ADR review; controller compromise, indirect leaks and wrong assessment logic remain possible | No guarantee or runtime acceptance inferred from ADR prose |
| R02 | docs/ownership.md and P00.02 use roles/titles rather than named accountable people | PRODUCT assign actual owners and independent reviewers in restricted record; reference evidence without personal details here | Required acceptance remains pending |
| R03 | ADR 0008 fixes seven-year financial retention without verified jurisdiction/provider basis | PRIVACY/FINANCE review retention, identifying fields and exceptions before P09.01/P09.03 | Do not implement blanket deletion/anonymization promises from this assumption |
| R04 | ADR 0008 promises provider audio terms and zero persistence; no selected-provider evidence exists | PRIVACY/AI verify provider settings, subprocessors, logs and buffering; retain text alternative if unsupported | Voice stays disabled until accepted |
| R05 | ADR 0005 allows controller sealed access; source plan mentions fixture injection, which can expose inputs to hostile code | SECURITY/ENG enforce minimal input projection, external oracle comparison and output filtering; never mount whole private bundle | P00.05 and isolated runner evidence required |
| R06 | Historical evidence verifies document structure; app source, live policies and real Git metadata are absent | ENG/OPS bootstrap separately; never run proposed scripts as successful existing checks | G00–G12 remain unmet |
| R07 | ADR 0008 short trace/code retention conflicts with future historical appeal reproducibility unless evidence is minimized | CONTENT/PRIVACY define retained hashes/decision summaries and appeal window without silently retaining raw content | Resolve in P06.03/P09.01 before launch |
| R08 | ASVS baseline is a selected subset; login strength and full remaining applicability are unresolved | SECURITY complete requirement disposition and authentication decision in P02.02/P11.04 | No full ASVS/L2 compliance claim |

These findings qualify design assumptions without silently changing accepted ADR behavior. Required corrections must be accepted in follow-up ADR amendments; this package does not certify privacy law compliance.

## Independent review checklist

Review F01–F13 with app, peer, controller, runner, content author, privacy worker and release identities separately. Attempt cross-user and cross-tenant reads/writes, direct private SQL/storage reads with real API/peer credentials, prompt/tool injection, output/trace exfiltration, resource exhaustion, payment replay, stale jobs, deletion races, restore resurrection, insider publication and malicious fork escalation. Record exact deployment role/config/image hashes, environment, denied/allowed results, severity, owner, due task and retest. Use synthetic nonsecret fixtures. Hostile execution tests must use the designated disposable isolated environment.

Review the selected ASVS requirements against release-tagged text and add omitted applicable controls. Verify effective IAM/network/DB behavior; manifests and scans alone are insufficient. No independent review has occurred in this session.

## Residual risk and acceptance

T01–T15 remain OPEN and their checks NOT RUN. Any tenant/answer/runner escape, unauthorized scoring, privileged CI escalation or uncontrolled spending blocks the affected capability and release until fixed and independently retested. Unknown provider privacy, backup expiry and legal retention remain open. A risk acceptance requires named human owner and reviewer, reason, scope, compensating controls, expiry/review trigger and evidence reference. None is granted here.

## Handoff

P00.03 local design artifacts are ready for review. P00.04 is the next independent READY task: build the capacity/cost model from dated provider prices, fixed/variable costs, reviewer labor and a bounded beta profile. P01.01 may prepare the workspace after P00.02; P00.05 remains gated on P00.03/P00.04 acceptance and authorized cloud budget/access. Revisit this model whenever data flow, provider, privilege, runtime or publication policy changes. No cloud resources were provisioned.
