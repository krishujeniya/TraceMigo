# Beta capacity and cost model

Task P00.04 · Updated 2026-10-30 · Status IN_REVIEW. Budget, region, provider access, node quote and named owners are not approved. This document authorizes no spending. All amounts are USD estimates before tax, FX and founder salary unless stated. No cloud resources or API calls were purchased or provisioned.

The **controlled 500-MAU beta models about $1,094/month including 20% contingency**. A regional deployment with three continuously warm trusted nodes and three sandbox nodes plus capped voice models **$1,621/month**, above the original $1,500 ceiling. A smaller 100-MAU cohort models **$853/month**. These are reproducible planning scenarios with unverified node and ancillary allowances, not account-specific quotes or measured capacity.

## Inputs, method and source quality

[capacity-cost-inputs.json](capacity-cost-inputs.json) records rates, units, sources, assumptions and unresolved approvals. Run `python3 docs/architecture/capacity_cost_model.py` from project root; the [offline calculator](capacity_cost_model.py) reads only local JSON and writes results to stdout. Raw calculation results are retained in ignored `planning/evidence/P00.04/results.json`; durable assumptions and formulas remain here for a clean checkout.

Reference cloud region: **us-central1 (Iowa)**, using the region visible in the fetched pricing tables. This is a price baseline, not the chosen deployment region. India-focused users make Mumbai (`asia-south1`) a candidate: OPS/PRIVACY must approve data location, service compatibility, latency and an actual regional calculator/SKU quote before provisioning. Iowa rates must not be relabeled as Mumbai rates. No free credits, spot discounts, commitments or promotional pricing are assumed. One month uses 730 billed infrastructure hours; traffic uses a separate 30-day month.

Verified means the public table was read on 2026-10-30, not that the service is available to this account. Allowance means an explicitly unverified placeholder. Provider access, paid tier, rate limits, tax, minimums, price changes and contract terms still need account confirmation.

| Source | Observed rate / limitation |
|---|---|
| [GKE](https://cloud.google.com/kubernetes-engine/pricing) | Global cluster fee 0.10 USD/hour; Standard VM nodes billed until deleted; no credit assumed. |
| [VM](https://cloud.google.com/products/compute/pricing/general-purpose) | Detailed table repeatedly timed out. Node allowances below are NOT verified SKU quotes. |
| [SQL](https://cloud.google.com/sql/pricing) | Iowa Enterprise general purpose: HA vCPU 0.0826/hour, HA GiB 0.014/hour; HA SSD 0.000465753/GiB-hour, backup 0.000109589/GiB-hour. |
| [RUN](https://cloud.google.com/run/pricing) | Iowa instance billing: CPU 0.000018/vCPU-second, RAM 0.000002/GiB-second. Free tier excluded. |
| [REDIS](https://cloud.google.com/memorystore/docs/redis/pricing) | Iowa M1 Standard 0.064 USD/GiB-hour; Basic 0.049. Model uses Standard. |
| [STORAGE](https://cloud.google.com/storage/pricing) | Iowa regional Standard 0.000027397/GiB-hour; request and transfer allowances separate. |
| [QUEUE](https://cloud.google.com/pubsub/pricing) | Basic throughput 40 USD/TiB; publish and subscribe bytes both count. Free tier excluded in model. |
| [LOG](https://cloud.google.com/products/observability/pricing) | Logging ingestion 0.50 USD/GiB, beyond free allocation; extra retention and metrics not included in that rate. |
| [OPENAI](https://developers.openai.com/api/docs/pricing) | Standard short-context USD per million tokens: gpt-6-luna input 0.10/output 0.50; gpt-6.1-sol input 2/output 10. gpt-4o-mini-transcribe estimated 0.003/minute. No account access/quality/latency verified. |
| [PAYMENT](https://razorpay.com/pricing/) | Standard 2% plus applicable GST; promotion not assumed; merchant contract and payment-method eligibility pending. |
| [BUDGET](https://docs.cloud.google.com/billing/docs/how-to/budgets) | Alerts-only budgets do not automatically cap usage/spend. |
| [CAP](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) | Spend caps cover eligible services; persistent compute/storage and in-flight costs continue; verify eligibility and enforcement before relying on them. |

Node allowances are **$0.08/hour for one 2-vCPU/8-GiB trusted node** and **$0.16/hour for one 4-vCPU/16-GiB sandbox node**. They are provisional shape/rate inputs; the detailed Google VM table timed out, so exact SKU prices were not verified. An E2-compatible shape is a hypothesis requiring P00.05 compatibility proof. Replace these values from an official account-region quote before acceptance. TTS is a separate unverified **$0.02/output minute** allowance; STT uses the published estimated $0.003/input minute. Reviewer rates are allowances, not supplier quotes.

## Beta load and admission envelope

Assume 20% of MAU active daily, one 20-minute deep session per DAU, six Python jobs and 60 durable events per session; 10x average peak. No compiled-language or custom-image jobs. One job occupies a slot for **10 seconds startup + 5 seconds running**, with a 10% retry allowance. Size slots for 60% utilization. These distributions and utilization are unmeasured; burst tails, image pulls, node boot and scheduling are separate test requirements.

- Monthly sessions = MAU × 0.20 × 1 × 30.
- Peak execution arrival rate = monthly sessions × 6 × 1.10 ÷ (30 × 86400) × 10.
- Slots = ceil(peak arrival rate × (10 + 5) ÷ 0.60).
- Assume one slot requests 1 vCPU/0.5 GiB and at most **three slots per 4-vCPU sandbox node**, leaving nominal CPU room for overhead. Kubernetes allocatable resources and gVisor overhead must be measured; three slots is not a scheduling guarantee.
- Charged sandbox node-hours = max(minimum nodes × 730 + explicit burst allowance, total reserved job slot-seconds ÷ 3600 ÷ 3 ÷ 0.60). Idle nodes and node boot/scale-down time are charged; pod runtime is not the whole bill.

| Scenario | MAU | Sessions/month | Jobs/month before retries | Peak learner sessions | Required slots | Required sandbox nodes at peak | Configured node cap |
|---|---|---|---|---|---|---|---|
| limited_beta | 100 | 600 | 3,600 | 2.78 | 1 | 1 | 1 |
| controlled_beta | 500 | 3,000 | 18,000 | 13.89 | 2 | 1 | 2 |
| regional_warm | 500 | 3,000 | 18,000 | 13.89 | 2 | 1 | 4 |
| scale_reference | 100,000 | 600,000 | 3,600,000 | 2777.78 | 382 | 128 | 128 |

Controlled beta: 500 MAU gives 100 DAU, 100 sessions/day, 600 intended jobs/day and 180,000 durable events/month. Expected peak jobs about 0.0764/s under the stated profile; two reserved slots suffice arithmetically. Propose a 16-session interactive concurrency cap and six global running execution slots; queue bounds and overload behavior must be tested. A slot calculation cannot establish p95 queue wait below 10 seconds. Zero sandbox minimum in the limited cohort saves idle cost but incurs cold starts; show queued/unavailable status and keep prerecorded traces labeled. Trusted system pool never scales to zero while the cluster is active.

Scale-reference 100k MAU reproduces the old 600k-session/month scenario, but now needs **382 slots / 128 four-vCPU sandbox nodes** under startup, retry and utilization allowances. The old 128-slot assumption is insufficient for this profile. Scale numbers are a workload stress reference only: the small database, Cloud Run capacity, logging and network allowances are invalid at that volume and require a separate P14.06 model and load evidence.

## Fixed infrastructure floor and scenario totals

All scenarios preserve separate trusted/sandbox pools, HA PostgreSQL (2 vCPU/8 GiB, 50 GiB HA SSD plus 50 GiB used backup), Standard Redis 1 GiB, two Cloud Run instance-billed services at 1 vCPU/0.5 GiB, and credential isolation. A zonal GKE topology is a reduced execution-availability proposal; it does not remove HA database costs or imply a production availability claim. A regional topology uses **three total nodes per pool across zones**, not three nodes in every zone.

Cloud Run is conservatively charged 24/7 for both warm instances; extra burst compute needs measurement and a refreshed estimate if max instances increase. Limited cohort: one trusted node, zero sandbox minimum, 120 sandbox node-hours/month allowance. Controlled: one trusted plus one warm sandbox, 60 additional sandbox node-hours. Regional: three trusted plus three warm sandbox, 60 additional node-hours. Controller runs in trusted pool. Staging/restore is a bounded window allowance, not another continuously active environment.

| Monthly component | Limited beta | Controlled beta | Regional warm |
|---|---|---|---|
| gke management | $73.00 | $73.00 | $73.00 |
| trusted nodes | $58.40 | $58.40 | $175.20 |
| sandbox idle floor | $0.00 | $116.80 | $350.40 |
| sql ha compute | $202.36 | $202.36 | $202.36 |
| sql ha disk backup | $21.00 | $21.00 | $21.00 |
| redis standard | $46.72 | $46.72 | $46.72 |
| cloud run warm | $99.86 | $99.86 | $99.86 |
| node disks | $30.00 | $30.00 | $30.00 |
| network egress lb nat dns | $50.00 | $50.00 | $50.00 |
| metrics trace extra retention | $20.00 | $20.00 | $20.00 |
| identity secrets kms ci registry | $50.00 | $50.00 | $50.00 |
| restore staging window | $25.00 | $25.00 | $25.00 |
| sandbox above idle | $19.20 | $9.60 | $9.60 |
| text provider | $4.92 | $98.50 | $98.50 |
| voice provider | $0.00 | $0.00 | $88.20 |
| object storage | $0.44 | $0.59 | $0.59 |
| queue throughput | $0.00 | $0.00 | $0.00 |
| log ingestion | $10.00 | $10.00 | $10.00 |
| Subtotal | $710.90 | $911.83 | $1,350.43 |
| Contingency (20%) | $142.18 | $182.37 | $270.09 |
| Planning total | $853.08 | $1,094.19 | $1,620.51 |

Node disks, network/LB/NAT/DNS, extra metrics/traces/log retention, identity/secrets/KMS/CI/registry and staging/restore are explicitly named monthly allowances. They cover unquoted charges, not verified rates or unlimited service. Standard object operations, export downloads and transfer beyond this envelope require re-estimation. A full additional staging clone is excluded; approvals must fund it if required. Storage growth, PITR WAL, export retention, support plans, regional transfer, extra environments and security tooling can exceed allowance. Cloud/network taxes and FX need separate funding; 20% contingency is no guarantee against those omissions. No credit or free-tier assumption hides persistent resource costs.

Trace storage assumes every dispatched job reaches its 2-MiB output maximum and seven-day steady-state retention; code snapshots use 128 KiB per session and 30-day retention. Controlled beta retains about 9.02 GiB of traces before object floor. Queue estimate counts publish and delivery separately at 2 KiB/leg; redelivery overhead is reflected only by the retry allowance. Logs use a fixed 20-GiB monthly planning envelope billed without free tier; actual provider and security logs must be measured and redacted. No arbitrary learner content enters observability.

## Text, voice and operation costs

Same original modeled session: 24 Luna turns × (3,000 input + 180 output tokens), plus one Sol semantic review × (6,000 input + 600 output). At the observed standard short-context rates, raw text cost is **$0.02736/session**; 20% billable usage/retry/reasoning reserve gives **$0.032832/session**. The semantic call is advisory and cannot write scores. No cached-input savings are counted; long-context, Fast/Ultrafast, cache writes, region uplifts and extra tools require a different rate. Actual billable usage can exceed this reserve; hard turn/context/output limits and ledger reconciliation are required. Model choice remains conditional on P07 quality/leakage/latency/account checks.

Limited cohort enables peer on 25% of sessions (150/month); controlled and regional scenarios allow peer on all 3,000 sessions. Voice remains off in the two smaller scenarios. Regional voice sensitivity assumes 25% of peer sessions use six input minutes and four output minutes. Raw voice increment = 6 × $0.003 + 4 × provisional $0.02 = **$0.098/session**, or $0.1176 with overhead. That adds $88.20/month before contingency. Voice has separate minute reservations and privacy/provider review; no full-duplex voice in beta.

With controlled beta idle/burst allowances, trusted+sandbox node allocation per intended job is about **$0.01027/job**, before management, disk, DB and other services. This is substantially higher than the old $0.0005–$0.002/job marginal assumption because idle capacity is allocated across only 18k jobs. Never add both full node cost and an allocated per-job node charge into one monthly total. At larger load occupancy improves, but contention, scale-out and HA costs change.

For an illustrative $15 international plan (provider approval pending), 40 bounded text sessions cost $1.31328 in text usage reserve. Adding 240 jobs at a provisional $0.002 incremental job allowance, 3.5% payment-fee allowance, 3% refund reserve and $1 incremental support yields $3.76828 variable cost: **74.88% modeled contribution margin**, before fixed infrastructure and taxes. At the controlled low-volume allocated node cost, 240 jobs cost about $2.46, moving the same illustrative contribution margin below 65%. These are different cost-allocation views, not profitability evidence; fixed nodes must not be counted twice. India ₹599 pricing needs a separate INR ledger with actual billing FX, tax treatment and merchant fee contract before contribution margin can be evaluated. Razorpay's public 2% + GST is not an international checkout approval or a universal cross-currency fee. No revenue, conversion or margin result is measured.

## Reviewer funding and review gate

One-time allowances: 30 cases × 2 reviews × 1.5 hours × $50/hour = **$4,500**; security review 24 hours + 8 hours retest × $125/hour = **$4,000**. $8,500 base plus 20% reserve = **$10,200**. Two distinct reviewers and independence requirements remain; the model funds two reviews per case and does not certify qualifications. Micro-exercise review, source authoring/licensing, privacy/legal specialist, operational coverage and major remediation are additional unquoted work. Quotes may exceed these values.

This slightly exceeds the original $5k–$10k external-review reserve even before additional work. Revise the funding proposal upward or reduce the reviewed release scope through explicit PRODUCT acceptance; never reduce mandatory security/content review to make the spreadsheet fit. Founder salary and ongoing labor are excluded from the infrastructure budget and must be funded separately.

## Budget and stop controls (proposed, not deployed)

Propose **$1,500/month infrastructure+model allowance ceiling**, including 20% forecast contingency, before taxes and labor; actual approved ceiling is **unset**. FINANCE owns budget acceptance, OPS owns shutdown, with named primary/backup people still **unassigned**. Until names, cloud quote, region and funding are recorded, no provisioning is authorized by this task. The lowest $500/month assumption is not supported by the modeled stack. Suggested scope: capped text-only controlled beta; defer voice and regional warm pools until measured need and funding. No accepted ADR or release SLO is silently waived; PRODUCT/OPS/SECURITY must accept reduced topology before use.

| Trigger / limit | Proposed behavior | Owner / delivery evidence |
|---|---|---|
| 50% / 80% of approved monthly forecast | Review daily forecast, idle resources and invoice; at 80% freeze optional experiments/scale increases | FINANCE/OPS; P08.04 |
| 90% of approved forecast | Pause new peer/voice and new execution admissions; keep saved reasoning and labeled recordings available | OPS; tested feature/dispatch switch in P05.04/P08.04 |
| 100% or missing/unhealthy budget authority | Reject new costly work; do not silently raise limits or auto-resume after month boundary | OPS + FINANCE; transactional ledger and month-rollover tests |
| Per-user work | Two active executions, one peer generation; 24 peer turns/session; explicit bounded context and output tokens | ENG/AI; P05.04/P07.01 |
| Global variable spend | Provisional $10/day reservation ceiling across paid inference and incremental execution; reserve before dispatch | FINANCE/ENG; concurrency/retry tests; not a cap on fixed costs |
| Controlled sandbox pool | One warm node, at most two total; global six running slots; bounded waiting queue and whole Job deadline 120s | OPS/SECURITY; P00.05/P05.04 effective enforcement |
| Voice | Off until privacy and funding acceptance; then per-user and global input/output minute reservations | PRIVACY/FINANCE; P09.02 |
| Trace/source/output | 128 KiB/10 files, 10k events or 2 MiB, stdout/stderr 64 KiB each; 10 CPU seconds/15 wall seconds after startup | SECURITY; effective isolated checks P00.05/P05.02 |

Cloud alerts-only budgets do not cap spend. Newer Google spend caps apply to eligible services and still allow persistent resource/in-flight costs; verify this account's supported services and limits before relying on them. Application reservations bound new metered work, not already-running nodes, disks or backup charges. No global exact-dollar cloud cap is claimed. Billing estimates arrive with delay; check reservation totals, actual usage and pending work together. Provider console limits, account quotas, cloud node/max-instance/storage bounds and tested kill switches supplement each other.

Shutdown sequence for a separately authorized environment: pause dispatch and new reservations; disable optional peer/voice; bound/drain current jobs; record costs/digests and preserve authorized state; scale sandbox pool down only as compatible with isolation; remove disposable cluster/compute/network resources after evidence collection; verify no orphan nodes/disks/addresses and check billing export later. Preserve recovery/tombstone records; do not delete user data or disable billing blindly to stop cost. Persistent HA database, disks and backups continue charging until explicitly reconfigured or removed. Named owner/backup, exact resource list, teardown authority and recovery procedure are required in P00.05. This document runs none of those actions.

## Sensitivity and acceptance still needed

| Controlled-beta change | Monthly plan including contingency | Slots | Peak nodes needed | Within proposed $1,500 |
|---|---|---|---|---|
| baseline | $1,094.19 | 2 | 1 | Yes |
| double_tokens | $1,212.39 | 2 | 1 | Yes |
| startup_60s | $1,094.19 | 9 | 3 | Yes |
| double_node_allowance | $1,315.95 | 2 | 1 | Yes |
| voice_all_sessions | $1,517.55 | 2 | 1 | No |

Startup stress illustrates arithmetic only: if node boot/image pull exceed the assumed startup distribution, slot headroom and queue targets must be remeasured even if monthly cost remains similar. Voice cost still depends on a provisional TTS allowance. Sensitivity assumes unchanged small database/service shapes; there is no load-test evidence for any row.

Acceptance pending: named FINANCE and OPS shutdown/backup owners; approved monthly ceiling and tax/FX contingency; selected region with account-specific VM/network/identity/CI quotes; reviewer quotes and scope; service quotas and model account access; P00.03 independent review; P00.05 cold-start, slot packing, network/isolation and teardown proof; P08.04 spend reconciliation; P11.06 admitted-load evidence. Findings cannot be cleared by this calculator alone.

P00.04 local research/calculation is ready for review; task remains IN_REVIEW. Next independent READY task is **P01.01 workspace bootstrap**, starting with the accepted ADR layout and package/import boundaries. P00.05 remains TODO while P00.03/P00.04 acceptance and authorized cloud access/budget are missing. Detailed working evidence lives under ignored planning/ and requires an explicit private handoff.
