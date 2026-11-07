# TraceMigo

Code-comprehension practice: read existing code, predict its behavior, trace execution, and explain evidence. The local web app includes a homepage and a two-exercise browser-only Python library: predict an output, step through a prerecorded trace, and write an explanation. Progress stays in sessionStorage for the tab. Accounts, server-saved learning workflows and isolated execution are not implemented yet.

See [bootstrap instructions](docs/development/bootstrap.md) for pinned tools, installation, local services, checks and known limitations. Start with Node 24.22.2, pnpm 12.16.1, uv 0.8.22 and Python 3.13.3:

```bash
pnpm install --frozen-lockfile
uv sync --frozen --all-packages
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm python:check
pnpm build
pnpm security:check
pnpm preview:check
pnpm dev
```

### Surfaces and Development Runners

* **Full Application (`apps/web`)**: Run `pnpm dev` to launch the Next.js development server at `http://127.0.0.1:3000` alongside Fastify API watchers.
* **Standalone Static Preview (`index.html`)**: Run `python3 run.py start` (or with `--bg`) to launch the contained single-page static preview on loopback `http://127.0.0.1:3000`. Stop with `python3 run.py stop`. The standalone server strictly serves `index.html` and blocks all repository source, planning, and dotfile paths. Run `pnpm preview:check` to verify server containment and process ownership.

| Path | Purpose |
|---|---|
| `apps/web` | Next.js homepage and local Python warmup preview |
| `apps/api` | Fastify contracts/config/errors/health foundation; product workflows not implemented |
| `packages/` | Root-exported contracts, pure domain types, UI, typed DB connections/migrations and execution references |
| `services/judge-controller` | Trusted orchestration interface; no execution dispatch |
| `runtimes/python` | Credential-free protocol metadata; no learner-code execution |
| `infra/local` | Loopback-only trusted development PostgreSQL/Redis configuration |
| `docs/` | Architecture decisions, threat model, cost model and development guidance |

See the [identity asset guide](docs/design/README.md) for brand exports, semantic tokens, font licensing and regeneration.

See the [database guide](docs/development/database.md) for migrations, roles, default-deny RLS and real PostgreSQL checks.

See the [API foundation](docs/development/api-foundation.md) for health endpoints, safe errors, configuration and shutdown.

Read [AGENTS.md](AGENTS.md) before making changes. [Architecture decisions](docs/adr/README.md), [security model](docs/threat-model/README.md) and [cost assumptions](docs/architecture/capacity-cost-model.md) define boundaries and open reviews.

The private `planning/` folder is ignored and absent from normal clones; obtain an explicit approved handoff to access the backlog and working evidence. No private answer bundles or credentials belong here. Cloud deployment, provider accounts, actual Git delivery settings, named security review and funding acceptance remain outstanding.

Open `/catalog` to choose running-total or list-reference practice. Each exercise keeps independent tab-local progress and uses the same predict/trace/explain flow. Both use fixed public examples and authored traces; no submitted code runs and explanations are not graded or sent to the API. For real-browser verification after a build, run `TRACEMIGO_CHECK_WARMUP=1 TRACEMIGO_CHECK_LIBRARY=1 TRACEMIGO_BROWSER_EVIDENCE=planning/evidence/U02 node tools/brand/browser-check.mjs` (requires local Chrome).

See [public artifact checks](docs/development/public-artifacts.md) for the local known-private-material/source-map guard and its limits.
