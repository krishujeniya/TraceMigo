# ADR 0002: Learning modes, attempt stages, and schema enum alignment

- **Status**: ACCEPTED
- **Date**: 2026-10-26
- **Accountable Owner**: ENG (TraceMigo Core Architecture)
- **Reviewers**: PRODUCT, CONTENT
- **Traceability**: REQ-P-04, Audit A07

## Context and Problem Statement

The original product specification referenced five high-level "learning modes" (Foundation, Practice, Independent Mock, AI-Assisted Mock, Review). However, the initial PostgreSQL schema defined `attempts.mode` as:
```sql
CREATE TYPE attempt_mode AS ENUM ('practice', 'mock_solo', 'mock_ai');
```
And simultaneously defined `attempts.stage` as:
```sql
CREATE TYPE attempt_stage AS ENUM ('warmup', 'predict', 'trace', 'explain', 'mutate', 'review');
```
This created conceptual and technical contradictions:
1. Is "Foundation" an execution mode, or is it a curriculum difficulty tier?
2. Is "Review" an attempt mode, a stage in the lifecycle of an attempt, or a spaced-repetition workflow?

## Decision

We formally separate **Attempt Execution Modes**, **Attempt Lifecycle Stages**, and **Curriculum Difficulty Tiers**:

1. **Attempt Execution Mode (`attempt_mode`)**:
   Governs peer availability, disclosure rules, and timer constraints during an active attempt session.
   ```sql
   CREATE TYPE attempt_mode AS ENUM (
     'practice',    -- Interactive practice with available peer dialogue and hints
     'mock_solo',   -- Simulated interview/exam without peer or oracle assistance
     'mock_ai'      -- Simulated interview with structured, turn-limited peer interaction
   );
   ```

2. **Attempt Lifecycle Stage (`attempt_stage`)**:
   Governs learner progress within a single attempt across the six core skills:
   ```sql
   CREATE TYPE attempt_stage AS ENUM (
     'warmup',      -- Initial code inspection and orientation
     'predict',     -- Mandatory output/state prediction before trace reveal
     'trace',       -- Stepping through recorded execution traces
     'explain',     -- Structured hypothesis/bug reasoning and complexity claims
     'mutate',      -- Applying and verifying behavior-preserving or defect-fixing patches
     'review'       -- Completed assessment review, appeal submission, and rubric feedback
   );
   ```

3. **Curriculum Classification (Foundation vs Core)**:
   "Foundation" is NOT an attempt mode. It is a curriculum tier stored on `problems.difficulty`:
   ```sql
   CREATE TYPE problem_difficulty AS ENUM (
     'foundation',  -- Explicitly scaffolded introductory cases (F0/F1, 40-100 lines)
     'core',        -- Standard real-world cases (F2/F3, 100-300 lines)
     'advanced'     -- Deep concurrency/distributed systems cases (F4, 200-400 lines)
   );
   ```
   Learners attempting a foundation problem execute in `practice` mode with specialized UI scaffolding enabled.

4. **Spaced Retrieval Workflow ("Review" Mode in Product Copy)**:
   When a learner performs a 1/3/7/21-day spaced repetition review, the system creates a new attempt record with `mode = 'practice'` and tags `context_source = 'spaced_retrieval'` linking to `prior_attempt_id`. The learner progresses through standard attempt stages (`predict` -> `trace` -> `explain`).

## Consequences

- **Positive**: Eliminates data model ambiguity; prevents state machine bugs; aligns UI progression with database constraints; ensures that rubric scores and attempts have unambiguous permissions.
- **Negative**: Product and marketing documentation must distinguish between "Foundation difficulty" and "Practice mode".
