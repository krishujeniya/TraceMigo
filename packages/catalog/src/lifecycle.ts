import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '@tracemigo/db';
import { calculateContentHash } from './hashing.js';
import type {
  ProblemDifficulty,
  PublicManifestEnvelope,
  ReviewDecision,
} from './types.js';

export interface CreateProblemParams {
  readonly id: string;
  readonly slug: string;
  readonly familyId: string;
  readonly difficulty: ProblemDifficulty;
  readonly sealed?: boolean;
}

export interface CreateDraftVersionParams {
  readonly id: string;
  readonly problemId: string;
  readonly versionNumber: number;
  readonly language?: 'python';
  readonly publicManifestKey: string;
  readonly publicManifest: PublicManifestEnvelope;
  readonly runtimeDigest: string;
  readonly contentHash?: string;
}

export interface AttachAuthorityParams {
  readonly versionId: string;
  readonly privateBundleKey: string;
  readonly oracleHash: string;
  readonly witnessHash: string;
}

export interface RecordReviewParams {
  readonly id: string;
  readonly versionId: string;
  readonly reviewerId: string;
  readonly revision: number;
  readonly decision: ReviewDecision;
  readonly testReportHash: string;
  readonly notes: {
    readonly schema_version: 'content.review.v1';
    readonly data: Record<string, unknown>;
  };
}

/**
 * Inserts a new problem definition in app.problems.
 */
export async function createProblem(
  db: Kysely<Database> | Transaction<Database>,
  params: CreateProblemParams
): Promise<void> {
  const { id, slug, familyId, difficulty, sealed = false } = params;
  await sql`
    INSERT INTO app.problems (id, slug, family_id, difficulty, sealed)
    VALUES (${id}, ${slug}, ${familyId}, ${difficulty}, ${sealed})
  `.execute(db);
}

/**
 * Inserts a new draft version in app.problem_versions.
 * Invariant: All versions start in 'draft' status.
 */
export async function createDraftVersion(
  db: Kysely<Database> | Transaction<Database>,
  params: CreateDraftVersionParams
): Promise<void> {
  const {
    id,
    problemId,
    versionNumber,
    language = 'python',
    publicManifestKey,
    publicManifest,
    runtimeDigest,
    contentHash = calculateContentHash(publicManifest),
  } = params;

  await sql`
    INSERT INTO app.problem_versions (
      id,
      problem_id,
      version_number,
      language,
      content_hash,
      public_manifest_key,
      public_manifest,
      runtime_digest
    ) VALUES (
      ${id},
      ${problemId},
      ${versionNumber},
      ${language},
      ${contentHash},
      ${publicManifestKey},
      ${JSON.stringify(publicManifest)}::jsonb,
      ${runtimeDigest}
    )
  `.execute(db);
}

/**
 * Attaches restricted authority records (oracle & witness hashes) in private.problem_authorities.
 */
export async function attachAuthority(
  db: Kysely<Database> | Transaction<Database>,
  params: AttachAuthorityParams
): Promise<void> {
  const { versionId, privateBundleKey, oracleHash, witnessHash } = params;
  await sql`
    INSERT INTO private.problem_authorities (
      version_id,
      private_bundle_key,
      oracle_hash,
      witness_hash
    ) VALUES (
      ${versionId},
      ${privateBundleKey},
      ${oracleHash},
      ${witnessHash}
    )
  `.execute(db);
}

/**
 * Records a formal content review entry in private.content_reviews.
 */
export async function recordContentReview(
  db: Kysely<Database> | Transaction<Database>,
  params: RecordReviewParams
): Promise<void> {
  const { id, versionId, reviewerId, revision, decision, testReportHash, notes } = params;
  await sql`
    INSERT INTO private.content_reviews (
      id,
      version_id,
      reviewer_id,
      revision,
      decision,
      test_report_hash,
      notes
    ) VALUES (
      ${id},
      ${versionId},
      ${reviewerId},
      ${revision},
      ${decision},
      ${testReportHash},
      ${JSON.stringify(notes)}::jsonb
    )
  `.execute(db);
}

/**
 * Moves a version from 'draft' to 'review'.
 */
export async function submitForReview(
  db: Kysely<Database> | Transaction<Database>,
  versionId: string
): Promise<void> {
  const res = await sql`
    UPDATE app.problem_versions
    SET status = 'review'
    WHERE id = ${versionId} AND status = 'draft'
    RETURNING id
  `.execute(db);

  if (res.rows.length === 0) {
    throw new Error(`Cannot submit version '${versionId}' for review: version not found or not in draft status.`);
  }
}

/**
 * Transitions a version from 'review' to 'published'.
 * PostgreSQL trigger private.guard_publication() will enforce:
 * 1. Prior status was 'review'.
 * 2. At least two distinct approving reviews in private.content_reviews.
 * 3. Authority record exists in private.problem_authorities.
 */
export async function publishVersion(
  db: Kysely<Database> | Transaction<Database>,
  versionId: string
): Promise<void> {
  await sql`
    UPDATE app.problem_versions
    SET status = 'published', published_at = now()
    WHERE id = ${versionId}
  `.execute(db);
}

/**
 * Retires an active version with an additive retirement record in app.problem_retirements.
 */
export async function retireVersion(
  db: Kysely<Database> | Transaction<Database>,
  versionId: string,
  reasonCode: string
): Promise<void> {
  if (!reasonCode || !/^[A-Z_]{1,80}$/.test(reasonCode)) {
    throw new Error(`Invalid retirement reason code: '${reasonCode}'. Must be uppercase A-Z and underscores, max 80 chars.`);
  }

  // Insert retirement audit record
  await sql`
    INSERT INTO app.problem_retirements (version_id, reason_code)
    VALUES (${versionId}, ${reasonCode})
  `.execute(db);
}
