# Local workspace bootstrap

P01.01 development foundation, 2026-10-30. No authentication, application persistence workflow, runner execution, grading, billing, cloud deployment or production readiness is implemented. P01.02 adds validated contracts, configuration, safe errors/logging and operational health endpoints; see [API foundation](api-foundation.md). API `/` still returns 501 NOT_IMPLEMENTED; the Next.js app now provides a public homepage and a browser-only warmup library at `/catalog` (U01/U02), linking `/warmup/python/running-total` and `/warmup/python/list-references`. Each fixed public example uses a prerecorded trace, not live execution or graded assessment. Prediction, trace position and optional explanation persist only in tab sessionStorage, with an in-memory fallback when storage is unavailable. Reset clears that local progress; no account or server attempt is created.

Use a trusted development environment without production credentials. Run the following from project root after installing Node **24.22.2**, pnpm **12.16.1**, uv **0.8.22** and Python **3.13.3**. Node must match the supported 24.x engine range; `.node-version` and `.nvmrc` select the verified patch. Python is pinned to the available supported 3.13 interpreter for reproducibility; refresh its security patch/toolchain before runtime release in P00.05. No global tools are installed by the repository. Revalidate pins before deployment; these are the versions checked for this bootstrap, not a permanent security guarantee.

```bash
node --version
pnpm --version
uv --version
pnpm install --frozen-lockfile
uv sync --frozen --all-packages
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm python:check
pnpm build
pnpm security:check
pnpm dev
```

Web: http://127.0.0.1:3000. API development composition root: http://127.0.0.1:3001. Stop with Ctrl+C. Root dev runs the API TypeScript watcher alongside its Node watcher and Next.js dev server; source edits rebuild the API. Start only web or API with `pnpm --filter @tracemigo/web dev` or `pnpm --filter @tracemigo/api dev` after the root build. For API source edits outside root dev, also run `pnpm --filter @tracemigo/api dev:compile` in another terminal. Server-only packages compile to `dist/` and expose only declared root exports. TypeScript project references build shared libraries before consumers; Next.js generates route types with `next typegen` before its separate no-emit project check, so fresh copies do not need existing `.next/` output.

`pnpm lint` checks executable package/import policy, tool JavaScript syntax and root JSON. TypeScript compiler checks syntax/types via `pnpm typecheck`. This bootstrap does not claim broad style or security scanning; P01.03 adds credential-safe CI/scanners. `pnpm test:unit` compiles API references and tests both import-policy bypass attempts and API configuration, privacy, validation, readiness and shutdown behavior; `pnpm python:check` statically checks the credential-free Python source and negative import fixtures. Application unit/integration/property/e2e tests are introduced with real behaviors, rather than scripts that return placeholder success.

## Tooling sources and install policy

Versions were read from the npm registry on 2026-10-30. [Node release policy](https://nodejs.org/en/about/previous-releases), [pnpm installation](https://pnpm.io/installation), [Turborepo workspace layout](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository), [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html), [Next TypeScript 7 support](https://nextjs.org/docs/app/api-reference/config/typescript), and [uv workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/) inform this setup. TypeScript 7 uses its compiler CLI; Babel AST parsing supplies dependency analysis independently of the absent TypeScript JS compiler API. pnpm's 24-hour release-age policy is retained. Lifecycle scripts remain subject to pnpm's dependency-build approval policy; do not blanket-approve downloaded scripts.

When no pnpm shim exists, Corepack can activate the root packageManager version in a user-managed environment, or install that exact pnpm version through the documented official installer. In a restricted session, caches, package-manager helpers and a downloaded Node binary may live under writable `/tmp` with no change to system tools. This session used `/tmp/tracemigo-bootstrap-tools/node_modules/.bin` on PATH and workspace `.pnpm-store`, plus `/tmp/tracemigo-uv-cache`; these are environment workarounds, not paths required on another machine. pnpm operation locks still required execution outside this session's filesystem sandbox.

P02.01 adds verified PostgreSQL schema/migrations and typed connections; see the [database guide](database.md). This does not wire database access into the API or clear security/identity gates.

## Local PostgreSQL and Redis

Docker Engine with Compose v2 is required for the optional trusted data services; it is not installed in the inspected environment. Image digests in `infra/local/.env.example` resolve Docker Official Images `postgres:17` and `redis:8` as of 2026-10-30. They are immutable multi-platform manifest references, not floating deployment tags. Image execution and database readiness remain to be verified where Docker is available. Manifest lookup alone does not certify compatibility or image security; P01.03 adds scans and controlled refresh.

```bash
cp infra/local/.env.example infra/local/.env
pnpm local:secrets
pnpm local:up
```

Compose publishes database/Redis ports only on loopback. PostgreSQL uses a generated 256-bit password file at `.local/postgres-password`, mode 0600; the generator never prints or overwrites it. Compose mounts the secret only into PostgreSQL. Read it locally when configuring a trusted application client; do not put it in tracked files or logs. Redis contains disposable development cache only and has no password inside its private Compose bridge; host access is loopback-only. Do not connect it to a shared/external network or store production data there. The application does not use either service yet.

`pnpm local:down` stops containers and keeps the database volume. Removing volumes destroys local data and requires an explicit decision; do not add `--volumes` casually. No cloud emulator, paid provider or network-accessible learner runner is started. Compose is **not** the gVisor execution plane. Never mount credentials or run learner code in these containers. PostgreSQL default development user is not evidence of deployed least-privilege/RLS roles; P02 implements and tests those separately.

## Boundaries and private handoff

The static checker has an explicit dependency allowlist. Pure contracts/domain/execution-client modules cannot import Node authority or third-party libraries. Browser/public UI cannot import application DB code. Package manifests, public export maps and source imports must agree; unknown workspace packages fail until classified. Nonliteral module loading, cross-package relative paths, absolute paths and internal aliases are rejected. This is a repository architecture check, not a hostile-code sandbox or a proof against every JavaScript metaprogramming technique. The Python package permits no external runtime dependency; stdlib imports have an explicit allowlist and authority calls are rejected. Future tracer needs require a reviewed extension.

`planning/` is intentionally ignored and will not travel with a normal clone. Obtain its approved private handoff for the task backlog and working evidence. Durable decisions, development instructions and sanitized release evidence belong outside planning. `.gitignore` is not access control: authoritative sealed bundles belong in restricted storage, never in this repository. Git metadata here is protected/empty; no repository initialization, commit or remote is claimed. P01.04 handles delivery settings separately.

Bootstrap acceptance evidence is retained under ignored `planning/evidence/P01.01/`; checks and limits must also be reported in the task handoff. P00.03/P00.04 remain IN_REVIEW; no bootstrap result clears security, funding, runtime or release gates.

M02 adds `pnpm security:check` after a production build: six synthetic leakage/failure-path tests plus inspection of public/client/prerendered artifacts. See [scope and limits](public-artifacts.md). This local guard does not complete P01.03 CI, third-party scans or security acceptance. `tools/smoke-bootstrap.mjs` checks the current homepage/library/warmup routes rather than the historical placeholder.
