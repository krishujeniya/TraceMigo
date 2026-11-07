# TraceMigo Architecture Decision Records (ADRs)

This directory records foundational architectural decisions for TraceMigo. ADRs define authoritative contracts, trust boundaries, schema designs, and operational policies that govern all subsequent implementation tasks.

## Status convention

- **PROPOSED**: Under active discussion/review; not yet binding.
- **ACCEPTED**: Formally approved by accountable domain owners; binding on all implementation tasks.
- **SUPERSEDED**: Replaced by a subsequent decision (must link to replacing ADR).

## Index of ADRs

| ADR | Title | Status | Decided Date | Resolves Audit / Requirement |
|---|---|---|---|---|
| [0001](0001-repository-layout-and-workspace-topology.md) | Repository layout and workspace topology | ACCEPTED | 2026-10-26 | REQ-P-07, REQ-P-08, Audit A01, A03 |
| [0002](0002-learning-modes-stages-and-schema-enums.md) | Learning modes, attempt stages, and schema enum alignment | ACCEPTED | 2026-10-26 | REQ-P-04, Audit A07 |
| [0003](0003-url-routing-and-canonical-structure.md) | URL routing, access boundaries, and canonical structure | ACCEPTED | 2026-10-26 | REQ-P-04, REQ-B-01, Audit A08 |
| [0004](0004-vector-search-scope-and-database-extensions.md) | Vector search scope and deferred pgvector migration | ACCEPTED | 2026-10-26 | REQ-P-07, Audit A06 |
| [0005](0005-content-publication-and-private-bundle-isolation.md) | Content publication and private bundle projection isolation | ACCEPTED | 2026-10-26 | REQ-P-03, REQ-P-07, Audit A09 |
| [0006](0006-content-derivation-and-assessment-secrecy.md) | Content derivation, micro-exercise isolation, and assessment secrecy | ACCEPTED | 2026-10-26 | REQ-P-01, REQ-P-03, Audit A13 |
| [0007](0007-assessment-authority-and-ai-peer-boundaries.md) | Assessment authority and AI peer boundary constraints | ACCEPTED | 2026-10-26 | REQ-P-04, REQ-P-05, Audit A15 |
| [0008](0008-data-retention-privacy-and-user-deletion.md) | Data retention, privacy controls, and user deletion lifecycles | ACCEPTED | 2026-10-26 | REQ-P-07, REQ-P-10, OPS-09 |
