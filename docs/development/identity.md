# Identity, Session Management, and Row-Level Security

P02.02, 2026-11-07. Implements cryptographically secure OIDC token verification, HTTP session cookie management, and transaction-local Row-Level Security (RLS) enforcement within `@tracemigo/identity`.

## 1. Architectural Scope and Standards Compliance

`@tracemigo/identity` provides identity resolution, session token issuance, and relational tenancy scoping. It connects `@tracemigo/contracts` with `@tracemigo/db`.

| ASVS Standard | Domain | Implementation Standard |
|---|---|---|
| ASVS v5.0.0-6.1.3 | Authentication | Cryptographic OIDC JWT verification (HS256/RS256) with mandatory issuer, audience, and expiration enforcement within 60s clock skew. |
| ASVS v5.0.0-7.1.1 | Session Management | HttpOnly, Secure, SameSite=Strict cookies; 256-bit entropy random tokens; instant revocation on logout; token rotation on privilege change. |
| ASVS v5.0.0-8.1.1 | Authorization | Forced PostgreSQL Row-Level Security (RLS) on non-owner roles (`tracemigo_app_role`); default-deny on missing or empty context. |
| ASVS v5.0.0-14.1.1 | Tenancy Isolation | Transaction-scoped `SET LOCAL` context prevents pool reuse leakage across tenant boundaries. |

---

## 2. OIDC Token Verification

OIDC tokens are validated via `verifyOidcToken(token, options)`.

### Claim Enforcement
- **Algorithm Verification**: Accepts only explicitly supported signing algorithms (`HS256`, `RS256`). Rejects `none` or unexpected algorithms.
- **Audience & Issuer**: Strictly compares `iss` against `expectedIssuer` and `aud` against `expectedAudience`.
- **Clock Skew Tolerance**: Enforces `exp` timestamp with a maximum 60-second clock skew tolerance window. Expired tokens throw `OidcVerificationError`.
- **Subject Extraction**: Validates that `sub` is present, non-empty, and mapped to internal UUID representations.

```typescript
import { verifyOidcToken } from '@tracemigo/identity';

const claims = verifyOidcToken(jwtString, {
  expectedIssuer: 'https://accounts.google.com',
  expectedAudience: 'tracemigo-client-id',
  clockSkewSeconds: 60,
  signingSecret: process.env.AUTH_JWT_SECRET,
});
```

---

## 3. Session Security and Cookie Management

### Security Flags
Session cookies issued by `createSessionCookie(token, options)` adhere to:
- `HttpOnly: true`: Completely inaccessible to client-side scripts to mitigate XSS impact.
- `Secure: true`: Required on all HTTPS connections (configurable for local loopback testing).
- `SameSite: Strict`: Protects against ambient transmission in cross-origin requests.
- `Path: /`: Scoped to entire domain hierarchy.
- `Max-Age: 604800`: 7-day maximum validity.

### Instant Revocation and Rotation
- **Logout**: `createLogoutCookie()` sets `Max-Age: 0` and an empty string value to clear the cookie immediately from the client agent.
- **Privilege Changes**: On tenant switch, role elevation, or credential change, `rotateSession(oldSession, newRole)` marks the previous session record as revoked (`revokedAt = new Date()`) and generates a fresh 256-bit session token.

---

## 4. Forced PostgreSQL Row-Level Security (RLS)

All tenant-scoped tables (`app.attempts`, `app.submissions`, `app.attempt_events`, `app.memberships`) enforce RLS through policies applied by `applyIdentityRlsPolicies(db)` under `tracemigo_owner`.

### Transaction-Local Scoping (`withTenantContext`)
Queries executing in an authenticated context must execute within `withTenantContext`:

```typescript
import { withTenantContext } from '@tracemigo/identity';

const attempts = await withTenantContext(
  db,
  { tenantId: '...', userId: '...', role: 'learner' },
  async (trx) => {
    return await trx.selectFrom('app.attempts').selectAll().execute();
  }
);
```

Under the hood, `withTenantContext` issues:
```sql
SELECT set_config('app.current_tenant_id', $1, true),
       set_config('app.current_user_id', $2, true),
       set_config('app.current_role', $3, true);
```
Passing `true` as the third parameter ensures that `set_config` is transaction-local (`SET LOCAL`), automatically unsetting the variables upon transaction commit or rollback.

### Default-Deny and Pool Leakage Defense
1. **Missing Context**: If a transaction or statement executes on a pooled connection without setting `app.current_tenant_id`, `current_setting('app.current_tenant_id', true)` evaluates to `NULL`. The condition `tenant_id = NULL` evaluates to `UNKNOWN` (treated as `FALSE`), returning zero rows.
2. **Cross-Tenant Mutation**: Attempts to `UPDATE` or `DELETE` rows belonging to another tenant return zero affected rows.
3. **Cross-Tenant Spoofing**: Attempts to `INSERT` rows with a `tenant_id` differing from the transaction-local context fail closed with SQL state `42501` (insufficient privilege).
4. **Role Boundary Defense**: Non-owner roles (`tracemigo_app_role`) lack `SUPERUSER` and `BYPASSRLS`. Attempting to set `SET ROLE tracemigo_owner` fails closed with SQL state `42501`.

---

## 5. Verification Commands

The test suite runs against a disposable PostgreSQL 17 cluster initialized via Unix domain sockets:

```bash
# Build identity package
pnpm --filter @tracemigo/identity build

# Execute full RLS isolation and session suite
pnpm test:identity
```
