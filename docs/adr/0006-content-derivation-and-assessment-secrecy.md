# ADR 0006: Content derivation, micro-exercise isolation, and assessment secrecy

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: CONTENT (TraceMigo Curriculum & Verification)
- **Reviewers**: PRODUCT, SECURITY
- **Traceability**: REQ-P-01, REQ-P-03, Audit A13

## Context and Problem Statement

The initial TraceMigo Python catalog specifies:
- 6 foundation cases (introductory scaffolding, F0-F1)
- 18 core cases (standard and deep practice, F2-F4)
- 6 sealed assessment cases (used strictly for independent diagnostic benchmarking and delayed transfer evaluation)
- 30 micro-exercises (fast 2-3 minute warmup cards)

If warmup micro-exercises or public previews are derived from the 6 sealed assessment cases, learners could inadvertently memorize execution patterns or code structures used in final assessments. This would invalidate the diagnostic validity of the platform and compromise learner evaluation integrity.

Additionally, future language expansion requirements (P14) required clarification regarding case counts and assessment splits.

## Decision

We establish strict content derivation rules and assessment isolation protocols:

### 1. Absolute Quarantine of Sealed Material
- The 6 sealed assessment cases are permanently quarantined from all discovery, public browsing, and anonymous warmup derivation.
- Sealed cases are never displayed in the public catalog, never accessible via anonymous warmups, and never provided to the AI Peer as few-shot exemplars.

### 2. Micro-Exercise Derivation Policy
- All 30 micro-exercises must be derived **exclusively** from the 24 non-sealed cases (6 foundation + 18 core cases).
- Each micro-exercise must be an independent sub-problem, AST slice, or focused mental-model check extracted from an approved, published practice case.
- Distribution:
  - 12 micro-exercises derived from the 6 foundation cases (2 per case).
  - 18 micro-exercises derived from the 18 core cases (1 per case).

### 3. Expansion Track Case Counts (P14)
For each subsequent language expansion (TypeScript, Java, Go, C++, Rust):
- Exactly **12 teaching cases** (4 foundation + 8 core practice) must be authored and independently reviewed.
- Exactly **2 separate sealed assessment cases** must be authored and sealed.
- Total requirement: 14 independent cases per language track. Under no circumstance may sealed assessment cases be counted toward the 12 teaching case requirement.

### 4. Automated Contamination Prevention
In P01 and P02, `pnpm content:validate` will enforce:
- Substring and AST token overlap checks between sealed case bodies and micro-exercise warmup content.
- An automated reject trigger if any sealed identifier, signature, or witness pattern is detected in public manifests or warmup assets.

## Consequences

- **Positive**: Preserves the psychometric and diagnostic integrity of assessments; ensures benchmark results reflect genuine code comprehension rather than rote pattern recall.
- **Negative**: Content authoring teams have a narrower base of 24 cases from which to extract 30 high-quality micro-exercises, requiring careful curriculum curation.
