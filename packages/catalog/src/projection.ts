import type {
  ProblemMetadata,
  ProblemVersionRecord,
  PublicProblemProjection,
} from './types.js';

export class ProjectionLeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionLeakageError';
  }
}

const FORBIDDEN_PROPERTY_NAMES = new Set([
  'private_bundle_key',
  'privateBundleKey',
  'oracle_source',
  'oracleSource',
  'oracle_hash',
  'oracleHash',
  'witness_hash',
  'witnessHash',
  'hidden_test_cases',
  'hiddenTestCases',
  'rubric_definitions',
  'rubricDefinitions',
  'rubric_nodes',
  'rubric_edges',
  'source_provenance',
]);

const FORBIDDEN_CONTENT_PATTERNS = [
  /sourceMappingURL\s*=/i,
  /\.js\.map\b/i,
  /\.ts\.map\b/i,
  /BEGIN (?:[A-Z]+ )?PRIVATE KEY/i,
  /CONFIDENTIAL\s+GROUND\s+TRUTH/i,
  /SEALED_ORACLE_ASSERTION/i,
];

/**
 * Deep scans any arbitrary payload to ensure no private keys, sealed answer fixtures,
 * rubrics, or source maps are present.
 */
export function assertNoLeakage(payload: unknown, currentPath = 'root'): void {
  if (payload === null || payload === undefined) return;

  if (typeof payload === 'string') {
    for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
      if (pattern.test(payload)) {
        throw new ProjectionLeakageError(
          `Forbidden content pattern matched at ${currentPath}: ${pattern}`
        );
      }
    }
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      assertNoLeakage(item, `${currentPath}[${index}]`);
    });
    return;
  }

  if (typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      if (FORBIDDEN_PROPERTY_NAMES.has(key)) {
        throw new ProjectionLeakageError(
          `Forbidden private property '${key}' detected at ${currentPath}.${key}`
        );
      }
      assertNoLeakage(value, `${currentPath}.${key}`);
    }
  }
}

/**
 * Creates a sanitised, learner-safe public projection from a published problem version.
 * Fails closed if the version is not published or if any private ground truth leaks.
 */
export function createPublicProjection(
  problem: ProblemMetadata,
  version: ProblemVersionRecord
): PublicProblemProjection {
  if (version.status !== 'published' || !version.publishedAt) {
    throw new Error(`Cannot create public projection for unpublished version (status: '${version.status}').`);
  }

  if (problem.sealed) {
    throw new Error(`Sealed problem '${problem.slug}' cannot be projected to public catalog.`);
  }

  const manifestData = version.publicManifest.data;

  const projection: PublicProblemProjection = {
    problemId: problem.id,
    slug: problem.slug,
    versionNumber: version.versionNumber,
    difficulty: problem.difficulty,
    title: manifestData.title,
    summary: manifestData.summary,
    language: version.language,
    entrypoint: manifestData.entrypoint,
    files: { ...manifestData.files },
    contentHash: version.contentHash,
    runtimeDigest: version.runtimeDigest,
    publishedAt: version.publishedAt.toISOString(),
    ...(manifestData.hints ? { hints: [...manifestData.hints] } : {}),
  };

  // Perform strict deep scan on projection before returning
  assertNoLeakage(projection);

  return projection;
}
