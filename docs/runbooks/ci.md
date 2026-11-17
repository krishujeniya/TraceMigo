# TraceMigo CI/CD & Supply Chain Security Runbook

**Document Version**: 1.0.0  
**Effective Date**: 2026-11-07  
**Accountable Role**: SECURITY / OPS (Krish Ujeniya)  
**Task Reference**: P01.03  
**Standards Compliance**: NIST SSDF SP 800-218 v1.1 (OPS-02), SLSA v1.2 Level 3 (OPS-04), GitHub Actions Hardening (REF-14), OWASP ASVS v5 (V1, V2, V14)

---

## 1. Overview and Security Invariants

TraceMigo enforces a **Secretless Continuous Integration and Delivery Pipeline**. The primary invariants are:
1. **Zero Secret Persistence**: No static cloud credentials, database passwords, or private API keys are ever stored in GitHub Secrets.
2. **Three-Tier Workflow Trust Partitioning**: Pull requests from untrusted contributors or external branches execute with strictly zero token permissions and zero network access to production resources.
3. **Strict Commit SHA Action Pinning**: Every third-party GitHub Action in `.github/workflows/` is pinned to an immutable 40-character commit SHA with an adjacent version comment. Floating tags (e.g. `@v4`, `@main`) are prohibited.
4. **Synthetic Negative Canary Ratchet**: CI must verify that scanners actively fail closed when exposed to seeded secrets, private answers, source maps, or dotfiles.
5. **No Learner Code Execution on CI Runners**: Untrusted user code submitted by learners is never executed on CI runner hosts or web/API servers. Execution is restricted to isolated sandbox pools (P05).

---

## 2. Three-Tier Workflow Trust Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                    WORKFLOW TRUST TIERS                                            |
+------------------------------+------------------------------+--------------------------------------+
| Tier 1: Untrusted PR         | Tier 2: Trusted Main Build   | Tier 3: Release / Deployment         |
| Workflow: ci.yml             | Workflow: ci.yml             | Workflow: release.yml                |
| Event: pull_request          | Event: push to main          | Event: workflow_dispatch / tag       |
+------------------------------+------------------------------+--------------------------------------+
| Permissions:                 | Permissions:                 | Permissions:                         |
|   contents: read             |   contents: read             |   contents: read                     |
|   id-token: none             |   packages: write            |   id-token: write (OIDC only)        |
|   issues: none               |   security-events: write     |   secrets: short-lived OIDC tokens   |
|   pull-requests: none        |   secrets: NONE              |                                      |
| Scope:                       | Scope:                       | Scope:                               |
|   - Frozen lockfile install  |   - Full test matrix         |   - Pre-release gate verification    |
|   - Boundary lint & types    |   - Public artifact scan     |   - GCP Workload Identity assume     |
|   - Unit & boundary tests    |   - Negative canaries        |   - Short-lived token (15m TTL)      |
|   - Python check             |   - Container build checks   |   - Production deployment            |
|   - Negative canary suite    |   - SBOM & provenance        |   - Refuses non-main execution       |
+------------------------------+------------------------------+--------------------------------------+
```

### Tier 1: Pull Request Verification (`ci.yml: tier1_untrusted_pr`)
- **Trigger**: Any PR targeting `main`.
- **Permissions**: `contents: read`, `id-token: none`.
- **Security Posture**: PR code runs in an unprivileged context. Secrets are inaccessible.
- **Fail-Closed Execution**: If any check fails, the PR cannot be merged.

### Tier 2: Trusted Branch Build (`ci.yml: tier2_trusted_main`)
- **Trigger**: Merge to `main`.
- **Permissions**: `contents: read`, `packages: write`, `security-events: write`.
- **Security Posture**: Packages artifacts and executes security scans.

### Tier 3: Release & Deployment (`release.yml: tier3_release_deploy`)
- **Trigger**: Manual `workflow_dispatch` or SemVer git tag (`v*`).
- **Permissions**: `contents: read`, `id-token: write`.
- **Branch Enforcement**: Fails immediately if triggered from a branch other than `main`.
- **OIDC Exchange**: Uses GitHub Actions OIDC (`google-github-actions/auth`) to assume a role in Google Cloud Workload Identity Federation. Emits short-lived access tokens (900 seconds TTL).

---

## 3. GitHub Action Pinning and Review Policy

All actions must be pinned to full 40-character commit SHAs. Dependabot is configured in `.github/dependabot.yml` to check for action updates weekly.

### Pinned Action Registry

| Action | Tag | Commit SHA | Purpose |
|---|---|---|---|
| `actions/checkout` | `v4.2.2` | `11bd71901bbe5b1630ceea73d27597364c9af683` | Git checkout |
| `actions/setup-node` | `v4.1.0` | `39370e3970a6d050c480ffad4ff0ed4d3fdee5af` | Node.js runtime setup |
| `actions/setup-python` | `v5.4.0` | `42375524e23c412d93fb67b49958b491fce71c38` | Python runtime setup |
| `pnpm/action-setup` | `v4.1.0` | `7088e561eb65bb68695d245aa206f005ef30921d` | pnpm package manager |
| `astral-sh/setup-uv` | `v5.2.1` | `b5f58b2abc5763ade55e4e9d0fe52cd1ff7979ca` | Astral uv Python tooling |
| `actions/configure-pages` | `v5.0.0` | `983d7736d9b0ae728b81ab479565c72886d7745b` | GitHub Pages configuration |
| `actions/upload-pages-artifact` | `v3.0.1` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | Pages artifact upload |
| `actions/deploy-pages` | `v4.0.5` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | Pages deployment |
| `google-github-actions/auth` | `v2.1.8` | `71f986410dfbc7added4569d411d040a91dc6935` | GCP OIDC authentication |

---

## 4. Synthetic Negative Canary Suite

Negative canary testing (`tools/ci/check-canaries.py`) verifies that our security guards fail closed before production releases:
1. **Seeded Secret**: Injects a high-entropy synthetic API token (`TRACEMIGO_PRIVATE_CANARY_...`); asserts scanner exits with code 1 and redacts matching token content from standard output.
2. **Private Key**: Injects a synthetic RSA private key block; asserts scanner exits with code 1 under rule `private-key`.
3. **Sealed Answer Authority**: Injects mock `sealed_answer` and `private_bundle_key` markers into rendered HTML/RSC; asserts scanner exits with code 1 under rule `private-authority`.
4. **Source Map Canary**: Injects a dummy `.js.map` file into public static assets; asserts scanner exits with code 1 under rule `forbidden-public-path`.
5. **Dotfile Canary**: Injects `.env.local` into public directory; asserts scanner exits with code 1.

### Running Canaries Locally
```bash
pnpm ci:canaries
# or
python3 tools/ci/check-canaries.py
```

---

## 5. Fail-Closed Missing Service Policy

TraceMigo strictly prohibits replacing missing integration dependencies with synthetic green passes:
- Disposable database tests (`pnpm test:db`) execute against real PostgreSQL 17 clusters on private Unix sockets. If `initdb` or `pg_ctl` is missing or fails, the command exits with a nonzero code.
- CI runners must never mock out failing security checks or swallow process exceptions.
- Test assertions ratchet upward; decreasing assertions without recorded architectural rationale fails review.
