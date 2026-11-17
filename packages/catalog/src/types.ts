export type ProblemDifficulty = 'foundation' | 'core' | 'advanced';
export type PublicationStatus = 'draft' | 'review' | 'published' | 'retired';
export type ReviewDecision = 'approve' | 'reject' | 'changes_requested';

export interface ProblemMetadata {
  readonly id: string;
  readonly slug: string;
  readonly familyId: string;
  readonly difficulty: ProblemDifficulty;
  readonly sealed: boolean;
  readonly createdAt?: Date;
}

export interface PublicManifestData {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly difficulty: ProblemDifficulty;
  readonly entrypoint: string;
  readonly files: Record<string, string>;
  readonly hints?: readonly string[];
  readonly warmup_refs?: readonly string[];
}

export interface PublicManifestEnvelope {
  readonly schema_version: 'case.public.v1';
  readonly data: PublicManifestData;
}

export interface HiddenTestCase {
  readonly name: string;
  readonly input: string;
  readonly expected_output: string;
}

export interface RubricDefinition {
  readonly dimension: 'functional_model' | 'trace' | 'bug_reasoning' | 'complexity' | 'refactoring' | 'communication';
  readonly criteria: string;
  readonly weight: number;
}

export interface PrivateBundleData {
  readonly oracle_source: string;
  readonly hidden_test_cases: readonly HiddenTestCase[];
  readonly expected_witness_hash: string;
  readonly rubric_definitions?: readonly RubricDefinition[];
}

export interface PrivateBundleEnvelope {
  readonly schema_version: 'case.private.v1';
  readonly data: PrivateBundleData;
}

export interface ProblemVersionRecord {
  readonly id: string;
  readonly problemId: string;
  readonly versionNumber: number;
  readonly status: PublicationStatus;
  readonly language: 'python';
  readonly contentHash: string;
  readonly publicManifestKey: string;
  readonly publicManifest: PublicManifestEnvelope;
  readonly runtimeDigest: string;
  readonly publishedAt: Date | null;
  readonly createdAt?: Date;
}

export interface ProblemAuthorityRecord {
  readonly versionId: string;
  readonly privateBundleKey: string;
  readonly oracleHash: string;
  readonly witnessHash: string;
  readonly createdAt?: Date;
}

export interface ContentReviewRecord {
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
  readonly createdAt?: Date;
}

export interface PublicProblemProjection {
  readonly problemId: string;
  readonly slug: string;
  readonly versionNumber: number;
  readonly difficulty: ProblemDifficulty;
  readonly title: string;
  readonly summary: string;
  readonly language: 'python';
  readonly entrypoint: string;
  readonly files: Record<string, string>;
  readonly contentHash: string;
  readonly runtimeDigest: string;
  readonly publishedAt: string;
  readonly hints?: readonly string[] | undefined;
}
