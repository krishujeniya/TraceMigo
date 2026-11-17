import { createHash } from 'node:crypto';

/**
 * Calculates a deterministic lowercase SHA-256 hash string for public content manifests.
 */
export function calculateContentHash(content: string | object): string {
  const normalized = typeof content === 'string' ? content : JSON.stringify(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Calculates a deterministic SHA-256 hash for private oracle code.
 */
export function calculateOracleHash(oracleSource: string): string {
  if (!oracleSource || typeof oracleSource !== 'string') {
    throw new Error('Oracle source must be a non-empty string.');
  }
  return createHash('sha256').update(oracleSource, 'utf8').digest('hex');
}

/**
 * Calculates a deterministic SHA-256 hash for witness execution fixtures.
 */
export function calculateWitnessHash(witnessData: string | object): string {
  const normalized = typeof witnessData === 'string' ? witnessData : JSON.stringify(witnessData);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
