export type UserRole = "learner" | "reviewer" | "admin";

export interface TenantContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: UserRole;
}

export interface OidcTokenClaims {
  readonly sub: string;
  readonly iss: string;
  readonly aud: string;
  readonly exp: number;
  readonly email?: string | undefined;
  readonly emailVerified?: boolean | undefined;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface SessionCookie {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict" | "Lax" | "None";
  readonly path: string;
  readonly maxAge: number;
}
