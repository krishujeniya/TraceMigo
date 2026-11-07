# TraceMigo threat model

Updated: 2026-10-30. Task P00.03. Status: IN_REVIEW; independent security review and named accountable acceptance pending. This is a design baseline; no security control is implemented or verified by these documents.

Read [data flows](data-flows.md), [asset classification](assets.md), [threat register](threats.md), [control mapping](asvs-mapping.md), and [review scope](review.md). Architecture inputs are the [ADR index](../adr/README.md) and [ownership record](../ownership.md). Requirement coverage: REQ-P-03, REQ-P-05, REQ-P-07, REQ-P-10, REQ-A-02.

## Scope and assumptions

Python-first adult learning service, trusted TypeScript application, PostgreSQL authority, advisory model peer, and separate isolated execution plane. Threat actors include anonymous automation, malicious authenticated learners, another tenant, compromised provider accounts, malicious content/dependencies, and privileged insiders. Browsers, submitted code, case comments, model output, queues, and runner results are untrusted at their receiving boundary. UUIDs and noindex are not authorization controls.

Every register entry specifies prevention, detection, a reproducible acceptance scenario, delivery tasks, and an accountable role. These are assignments to roles only; actual people must be recorded privately before acceptance. All runtime checks remain NOT RUN. Initial severity reflects impact before controls: Critical means tenant/answer/runner/privileged delivery compromise; High means account, payment, privacy, integrity, or material availability loss. Residual risk remains open until implementation evidence and review exist.

## Security invariants

1. Ordinary API and peer identities cannot read private ground truth or private object keys, including through exports, logs, error messages, source maps, or caches.
2. The peer can propose a response; trusted policy authorizes assistance and deterministic assessment writes scores. Prompts do not grant capabilities.
3. Learner code and untrusted static analysis run only in fresh isolated Jobs without workload credentials or network egress. Expected outputs and grading authority stay outside the process.
4. Every user-owned object, child record, subscription, artifact, and replay stream is authorized using server-resolved membership and ownership; pooled DB context is transaction-local.
5. Quota reservation, revisions, deduplication, and state transitions commit before costly dispatch. Missing budget or unavailable authority fails closed for paid work.
6. Publication, artifact digests, evidence provenance, and score revisions are auditable. Cancelled, deleted, or finalized work cannot be revived by stale callbacks.
7. Sensitive data has explicit access, retention, deletion, restore, and logging controls. No document is evidence of legal compliance or provider guarantees.

## Verification boundary

Run `python3 planning/evidence/P00.03/validate.py` to check document references, register coverage, tracker dependencies, and preservation of original inputs. This checks structure only. Runtime denial, independent review, and release acceptance require the scenarios in the register and remain NOT RUN. See [validation evidence](../../planning/evidence/P00.03/validation.md); planning evidence must be supplied separately because `/planning/` is ignored.
