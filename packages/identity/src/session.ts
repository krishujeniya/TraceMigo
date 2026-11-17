import { randomBytes } from "node:crypto";
import type { SessionCookie, SessionRecord, UserRole } from "./types.js";

export const SESSION_COOKIE_NAME = "tracemigo_session";
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Generates a cryptographically secure 256-bit random session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Builds an ASVS v5.0.0-7.1.1 compliant session cookie descriptor.
 * Always sets HttpOnly, SameSite=Strict, and Secure (with localhost exception).
 */
export function createSessionCookie(
  token: string,
  options: { isProduction?: boolean; maxAgeSeconds?: number } = {}
): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: options.isProduction ?? true,
    sameSite: "Strict",
    path: "/",
    maxAge: options.maxAgeSeconds ?? DEFAULT_SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Formats a SessionCookie descriptor into a standard HTTP Set-Cookie header string.
 */
export function serializeCookieHeader(cookie: SessionCookie): string {
  const parts = [
    `${cookie.name}=${cookie.value}`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    `SameSite=${cookie.sameSite}`,
  ];

  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Creates an expired cookie to instruct the browser to clear the session immediately.
 */
export function createLogoutCookie(options: { isProduction?: boolean } = {}): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: options.isProduction ?? true,
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  };
}

/**
 * In-memory or database session model helper.
 */
export function createSessionRecord(
  token: string,
  userId: string,
  tenantId: string,
  role: UserRole,
  ttlSeconds: number = DEFAULT_SESSION_MAX_AGE_SECONDS
): SessionRecord {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  return {
    id: token,
    userId,
    tenantId,
    role,
    createdAt: now,
    expiresAt,
    revokedAt: null,
  };
}

/**
 * Rotates an active session to a fresh token on privilege changes (e.g. role change or MFA).
 */
export function rotateSession(
  oldSession: SessionRecord,
  newRole?: UserRole
): { oldSession: SessionRecord; newSession: SessionRecord } {
  const now = new Date();
  const revokedOldSession: SessionRecord = {
    ...oldSession,
    revokedAt: now,
  };

  const newToken = generateSessionToken();
  const newSession = createSessionRecord(
    newToken,
    oldSession.userId,
    oldSession.tenantId,
    newRole ?? oldSession.role
  );

  return {
    oldSession: revokedOldSession,
    newSession,
  };
}
