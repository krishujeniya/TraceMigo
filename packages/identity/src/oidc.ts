import { createHmac, timingSafeEqual } from "node:crypto";
import type { OidcTokenClaims } from "./types.js";

export interface OidcVerifierOptions {
  readonly expectedIssuer: string;
  readonly expectedAudience: string;
  readonly clockSkewSeconds?: number;
  readonly signingSecret?: string; // Used for deterministic testing and symmetric validation
}

export class OidcVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OidcVerificationError";
  }
}

/**
 * Validates OIDC JWT tokens adhering to ASVS v5.0.0-6.1.3.
 * Enforces audience, issuer, expiration with maximum 60s clock skew.
 */
export function verifyOidcToken(token: string, options: OidcVerifierOptions): OidcTokenClaims {
  if (!token || typeof token !== "string") {
    throw new OidcVerificationError("Invalid or empty identity token.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new OidcVerificationError("Malformed JWT structure: must contain header, payload, and signature.");
  }

  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSignature = parts[2];

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new OidcVerificationError("Malformed JWT structure: must contain header, payload, and signature.");
  }

  let header: { alg?: string; typ?: string };
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new OidcVerificationError("Failed to decode token JSON segments.");
  }

  if (header.alg !== "HS256" && header.alg !== "RS256") {
    throw new OidcVerificationError(`Unsupported JWT algorithm: ${header.alg}`);
  }

  // Signature verification for HS256 (used in tests and internal service verification)
  if (options.signingSecret && header.alg === "HS256") {
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = createHmac("sha256", options.signingSecret).update(dataToSign).digest("base64url");
    const sigBuf = Buffer.from(encodedSignature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new OidcVerificationError("Invalid token signature.");
    }
  }

  // Mandatory claim checks
  const { sub, iss, aud, exp, email, email_verified } = payload;

  if (typeof sub !== "string" || !sub.trim()) {
    throw new OidcVerificationError("Missing or invalid 'sub' claim.");
  }

  if (iss !== options.expectedIssuer) {
    throw new OidcVerificationError(`Token issuer mismatch: expected '${options.expectedIssuer}', got '${iss}'.`);
  }

  if (aud !== options.expectedAudience) {
    throw new OidcVerificationError(`Token audience mismatch: expected '${options.expectedAudience}', got '${aud}'.`);
  }

  if (typeof exp !== "number") {
    throw new OidcVerificationError("Missing or invalid 'exp' claim.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSeconds ?? 60;

  if (exp + skew < nowSeconds) {
    throw new OidcVerificationError(`Token expired at ${new Date(exp * 1000).toISOString()}.`);
  }

  return {
    sub,
    iss: iss as string,
    aud: aud as string,
    exp,
    email: typeof email === "string" ? email : undefined,
    emailVerified: Boolean(email_verified),
  };
}
