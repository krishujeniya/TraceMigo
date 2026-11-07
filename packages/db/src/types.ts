import type { ColumnType, Generated } from "kysely";
export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
export interface Envelope { readonly schema_version: string; readonly data: Readonly<Record<string, unknown>> }
interface Owned { tenant_id: string; user_id: string }
interface AttemptOwned extends Owned { attempt_id: string }
interface Identified { id: string; created_at: CreatedAt }
export interface Tenant extends Identified { name: string }
export interface User extends Identified { oidc_issuer: string; oidc_subject: string }
export interface Membership extends Owned { role: "learner" | "reviewer" | "admin"; created_at: CreatedAt }
export interface Problem extends Identified { slug: string; family_id: string; difficulty: "foundation" | "core" | "advanced"; sealed: Generated<boolean> }
export interface ProblemVersion extends Identified {
  problem_id: string; version_number: number; status: Generated<"draft" | "review" | "published" | "retired">;
  language: "python"; content_hash: string; public_manifest_key: string; public_manifest: Envelope; runtime_digest: string; published_at: Timestamp | null;
}
export interface Attempt extends Identified, Owned {
  problem_version_id: string; mode: "practice" | "mock_solo" | "mock_ai";
  stage: Generated<"warmup" | "predict" | "trace" | "explain" | "mutate" | "review">;
  status: Generated<"active" | "paused" | "submitted" | "assessing" | "completed" | "abandoned">;
  revision: Generated<string>; disclosure_level: Generated<number>; context_source: Generated<"direct" | "spaced_retrieval">;
  prior_attempt_id: string | null; started_at: CreatedAt; finished_at: Timestamp | null; last_activity_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export interface Submission extends Identified, AttemptOwned { source_sha256: string; object_key: string }
export interface ExecutionJob extends Identified, AttemptOwned {
  submission_id: string; idempotency_key: string; request_sha256: string;
  state: Generated<"queued" | "leased" | "running" | "succeeded" | "failed" | "cancelled" | "expired">;
  lease_epoch: Generated<string>; lease_until: Timestamp | null; runtime_digest: string; result_key: string | null;
}
export interface Observation extends Identified, AttemptOwned { execution_job_id: string | null; kind: string; evidence: Envelope; verification_status: "unverified" | "verified" | "rejected"; verifier_version: string }
export interface SkillEvidence extends Identified, AttemptOwned { concept_id: string; independent: boolean; outcome: "correct" | "partial" | "incorrect" | "unavailable"; assistance_level: number; evidence_version: string }
export interface PeerTurn extends Identified, AttemptOwned { turn_number: number; role: "learner" | "peer"; role_reason: Envelope; model_id: string; prompt_version: string; evidence_ids: Envelope; confirmed_text: string | null; usage: Envelope }
export interface Assessment extends Identified, AttemptOwned { revision: number; rubric_version: string; dimension_scores: Envelope; evidence_ids: Envelope; confidence: string; decision_source: "deterministic" | "human_review" }
export interface Appeal extends Identified, AttemptOwned { result_id: string; explanation: string; status: Generated<"open" | "under_review" | "resolved" | "rejected">; reviewer_id: string | null; decision: "upheld" | "corrected" | "rejected" | null; replacement_result_id: string | null }
export interface Database {
  tenants: Tenant; users: User; memberships: Membership; problems: Problem; problem_versions: ProblemVersion;
  concepts: { id: string; title: string }; concept_edges: { id: string; from_id: string; to_id: string; relation: "prerequisite" | "related" };
  attempts: Omit<Attempt, "created_at">; submissions: Submission; execution_jobs: ExecutionJob; observations: Observation;
  skill_evidence: SkillEvidence; peer_turns: PeerTurn; assessment_results: Assessment; appeals: Appeal;
  attempt_events: AttemptOwned & { seq: string; event_id: string; event_type: string; payload: Envelope; created_at: CreatedAt };
  problem_retirements: { version_id: string; reason_code: string; created_at: CreatedAt };
  user_preferences: Identified & { user_id: string; locale: Generated<string>; timezone: Generated<string>; assistance_settings: Envelope };
  consents: Identified & { user_id: string; purpose: "voice" | "journal" | "research" | "personalization"; consent_version: string; granted_at: Timestamp; revoked_at: Timestamp | null };
  entitlements: Identified & Owned & { product: string; starts_at: Timestamp; ends_at: Timestamp; quota_policy: Envelope; provider_purchase_id: string; state: Generated<"active" | "revoked" | "expired"> };
}
