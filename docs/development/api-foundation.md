# API foundation

P01.02, 2026-10-30. The Fastify service now validates configuration before listening, emits server-owned request IDs and safe problem details, provides liveness/readiness, and drains accepted HTTP requests on shutdown. Authentication, persistence, model providers, execution, scoring and durable background jobs remain unimplemented.

## Start and inspect

Use the pinned tools and frozen installs from [bootstrap.md](bootstrap.md), then run `pnpm build` and `pnpm --filter @tracemigo/api start`. The default listener is `127.0.0.1:3001`. The built server accepts SIGINT/SIGTERM and stops admitting requests before it drains accepted HTTP work. No request in this foundation returns 202 or claims to have durably accepted a background job.

| Route | Normal response | Meaning |
|---|---|---|
| `GET /v1/health/live` | 200, `{"status":"alive"}` | Process can serve a request; does not probe dependencies |
| `GET /v1/health/ready` | 200 with `scope: api-foundation` and explicit `model: disabled`, `judge: disabled` | Only this API foundation is ready; does not establish product, DB, sandbox or provider readiness |
| `/` | 501 `NOT_IMPLEMENTED` | Product root remains unavailable |
| Unknown route | 404 `NOT_FOUND` | Does not reflect the URL or query into responses/logs |

All handled requests receive `x-request-id` (server-generated UUIDv4) and `Cache-Control: no-store`. Client `x-request-id`/`request-id` values are ignored; they are not trusted correlation identities. Request IDs stay available on failures. Malformed URLs handled by Fastify also use the problem envelope. HTTP transport failures rejected by Node before Fastify creates a request can use transport-level responses and are outside this application contract.

## Configuration

Environment parsing occurs before the listener opens. Invalid values, unknown `TRACEMIGO_` variables, unsupported adapters and unsafe test settings terminate startup with exit 1 and a fixed `configuration_invalid` event. Configuration values, exceptions and stacks are not printed. Other process environment variables are not treated as API configuration. Never place secrets in command lines or tracked examples.

| Variable | Default | Accepted values |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test`, `production` |
| `TRACEMIGO_HOST` | `127.0.0.1` | Explicit `127.0.0.1`, `::1`, `0.0.0.0`, `::`; broad binding requires deliberate configuration |
| `TRACEMIGO_PORT` | `3001` | Decimal integer 0–65535; 0 requests an ephemeral port in development/tests; production requires 1–65535 |
| `TRACEMIGO_BODY_LIMIT` | `131072` | 1024–131072 bytes for the complete HTTP body; not the future source-file payload contract |
| `TRACEMIGO_SHUTDOWN_TIMEOUT_MS` | `10000` | Integer 100–30000 ms |
| `TRACEMIGO_PROBE_TIMEOUT_MS` | `500` | Integer 10–5000 ms |
| `TRACEMIGO_LOG_LEVEL` | `info` | `info`, `error`, `silent`; production forbids silent |
| `TRACEMIGO_MODEL_ADAPTER` | `disabled` | `disabled`; `test` requires NODE_ENV=test and explicitly supplied test fixture |
| `TRACEMIGO_JUDGE_ADAPTER` | `disabled` | Same guard as model adapter |

Numeric parsing rejects empty, signed, whitespace-padded, fractional, exponent and overflow values. The parsed configuration is immutable. `runtimeConfigSchema` in the pure contracts package specifies the typed configuration, including production restrictions; the environment parser performs conversion and checks. A production process cannot downgrade its environment through a programmatic environment override. This is a defense in depth guard for trusted composition code, not a defense against arbitrary code execution or deliberate mutation of the process environment.

## Shared schemas and errors

`@tracemigo/contracts` exports the protocol identifier, confirmed-text input schema/type, problem-details schema/type, runtime configuration schema/type and health response schemas. It imports no Node, DB, cloud or third-party authority. Schemas are trusted source assets; never compile a user-supplied schema. Future endpoints must attach them before consuming input. There is no public peer-turn endpoint yet; its input contract is exercised through test-only routes.

Fastify validation rejects unknown fields and wrong types, without silently stripping extra properties, coercing values or supplying request defaults. Confirmed text requires a non-whitespace string, up to 4096 characters. Byte limits apply independently. Validation issues use the fixed `body` field label and `INVALID_VALUE` code so attacker-controlled property names and values cannot leak into errors.

Problem responses use `application/problem+json`, for example:

```json
{
  "type": "about:blank",
  "title": "Invalid request",
  "status": 422,
  "code": "INVALID_REQUEST",
  "request_id": "00000000-0000-4000-8000-000000000000",
  "field_errors": [{"field":"body","code":"INVALID_VALUE"}]
}
```

The example ID is illustrative. Runtime IDs are random. The envelope follows [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), which supersedes the earlier RFC 7807 reference in the architecture. No URI `instance`, raw validation message, stack, request URL, SQL detail, user body or exception header is copied into a problem response.

| Code | HTTP status |
|---|---|
| `MALFORMED_REQUEST`, `MALFORMED_JSON` | 400 |
| `NOT_FOUND` | 404 |
| `REQUEST_TIMEOUT` | 408 (reserved contract code; transport timeout handling is not universally covered) |
| `PAYLOAD_TOO_LARGE` | 413 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `INVALID_REQUEST` | 422 |
| `INTERNAL_ERROR` | 500 |
| `NOT_IMPLEMENTED` | 501 |
| `NOT_READY`, `SHUTTING_DOWN`, `FEATURE_UNAVAILABLE` | 503 |

Unexpected thrown errors become a generic 500, including errors carrying their own status or headers. Disabled adapters throw `CapabilityUnavailable`; routes that use them get a safe 503, never fabricated output. Error statuses for future authorization, idempotency, quota and revision behavior belong to their implementation tasks.

## Content-free logging

Fastify's built-in request/error logger is disabled. A single allowlisted JSON logger projects events onto only `event`, generated `request_id`, known route category, known HTTP method, numeric status and startup port. Unknown fields are dropped. Route categories are fixed labels, so dynamic paths, query tokens and learner identifiers are not recorded. Headers, cookies, authorization, code, raw answers, prompts, transcripts, provider output, exception text and arbitrary nested fields are never passed through to a log sink. This intentionally drops raw data rather than attempting to guess every possible secret name.

The allowlist is not a scanner for other packages' future logs. New observability paths need their own tests. A synchronous sink failure marks logging unavailable; subsequent readiness checks fail instead of reporting green. Asynchronous exporter failures and remote log delivery acknowledgement are not implemented. Level `error` keeps failure events only; successful request counts/metrics need a later metrics implementation.

## Readiness and test adapters

Trusted composition may register up to eight dependency probes, each receiving an AbortSignal. Checks must return true, failures/throws/timeouts produce generic readiness 503, and concurrent readiness requests share a probe batch. The timeout aborts checks. A check that ignores cancellation cannot accumulate additional probes: readiness remains unavailable until that batch settles or the process restarts. Registration is for trusted server code, never a client-supplied endpoint or URL. No DB/model/judge probes are registered by default because those capabilities do not exist yet. Future required dependencies must be registered before their feature is advertised.

Deterministic model/judge fixtures live in `apps/api/src/testing.ts`, outside public package exports and production composition imports. They only return clearly marked synthetic test output, with no score or real execution. Both environment selection and injected fixture/route guards reject tests in production/development. Test routes are installed only through an explicit NODE_ENV=test option; the normal service exposes none. A test adapter requires explicit fixture injection and is never an automatic fallback for a missing service.

## Shutdown and limits

`shutdown()` is idempotent. It marks readiness unavailable, returns problem 503 for new requests, waits for previously admitted requests, closes the HTTP server and then closes adapters once. Request completion, abort and timeout release admission tracking. Existing synchronous HTTP work must finish within the configured deadline. The real entry point handles SIGINT/SIGTERM through the same lifecycle.

If draining or adapter cleanup exceeds the deadline, sockets close and shutdown fails with a fixed event and nonzero entry-point exit status; no completion success is claimed. A timeout cannot prove unfinished work was preserved. Durable future jobs must be committed before 202 and fenced/recoverable independently of process lifetime. Current tests establish HTTP drain behavior only, not job durability. Container termination grace must exceed this application deadline when deployment is implemented.

## Verification and remaining gates

`pnpm test:unit` compiles API references, then runs the architecture tests and API foundation tests: config/schema failure cases, request IDs, parser/body limits, test-only guards, synthetic secret suppression, readiness timeout/recovery and drain/deadline behavior. `node tools/smoke-api-lifecycle.mjs` after build checks actual subprocess rejection of bad config/test adapters, production override protection, loopback startup, SIGTERM and in-flight HTTP draining. It binds only temporary loopback ports and stops its servers.

[Fastify server lifecycle](https://fastify.dev/docs/latest/Reference/Server/), [validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) and [logging](https://fastify.dev/docs/latest/Reference/Logging/) were checked for the pinned Fastify 5.12.7 APIs. No package dependency/version or lockfile changed in P01.02. Existing Docker/DB integration, external providers, isolated execution, CI, independent security review and budget acceptance remain outstanding. Working task evidence stays under ignored planning/evidence/P01.02/ and requires explicit private handoff.
