/** Public schemas and identifiers; never include private assessment authority. */
export const WORKSPACE_PROTOCOL = "workspace.v1" as const;
export type WorkspaceProtocol = typeof WORKSPACE_PROTOCOL;

export const requestIdPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
export const peerTurnInputSchema = {
  type: "object", additionalProperties: false, required: ["confirmed_text"],
  properties: { confirmed_text: { type: "string", minLength: 1, maxLength: 4096, pattern: "\\S" } },
} as const;
export interface PeerTurnInput { readonly confirmed_text: string }

export const problemCodes = [
  "INVALID_REQUEST", "MALFORMED_REQUEST", "MALFORMED_JSON", "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE",
  "NOT_FOUND", "NOT_IMPLEMENTED", "INTERNAL_ERROR", "NOT_READY", "SHUTTING_DOWN",
  "FEATURE_UNAVAILABLE", "REQUEST_TIMEOUT",
] as const;
export type ProblemCode = typeof problemCodes[number];
export interface FieldError { readonly field: "body" | "confirmed_text"; readonly code: "INVALID_VALUE" }
export interface ProblemDetails {
  readonly type: "about:blank";
  readonly title: string;
  readonly status: number;
  readonly code: ProblemCode;
  readonly request_id: string;
  readonly field_errors?: readonly FieldError[];
}
export const problemDetailsSchema = {
  type: "object", additionalProperties: false,
  required: ["type", "title", "status", "code", "request_id"],
  properties: {
    type: { const: "about:blank" }, title: { type: "string", maxLength: 80 },
    status: { type: "integer", minimum: 400, maximum: 599 },
    code: { type: "string", enum: problemCodes }, request_id: { type: "string", pattern: requestIdPattern },
    field_errors: { type: "array", maxItems: 8, items: {
      type: "object", additionalProperties: false, required: ["field", "code"],
      properties: { field: { enum: ["body", "confirmed_text"] }, code: { const: "INVALID_VALUE" } },
    } },
  },
} as const;

export const runtimeConfigSchema = {
  type: "object", additionalProperties: false,
  required: ["environment", "host", "port", "bodyLimit", "shutdownTimeoutMs", "probeTimeoutMs", "logLevel", "modelAdapter", "judgeAdapter"],
  properties: {
    environment: { enum: ["development", "test", "production"] },
    host: { enum: ["127.0.0.1", "0.0.0.0", "::1", "::"] },
    port: { type: "integer", minimum: 0, maximum: 65535 },
    bodyLimit: { type: "integer", minimum: 1024, maximum: 131072 },
    shutdownTimeoutMs: { type: "integer", minimum: 100, maximum: 30000 },
    probeTimeoutMs: { type: "integer", minimum: 10, maximum: 5000 },
    logLevel: { enum: ["info", "error", "silent"] },
    modelAdapter: { enum: ["disabled", "test"] }, judgeAdapter: { enum: ["disabled", "test"] },
  },
  allOf: [{ if: { properties: { environment: { enum: ["development", "production"] } } },
    then: { properties: { modelAdapter: { const: "disabled" }, judgeAdapter: { const: "disabled" } } },
  }, { if: { properties: { environment: { const: "production" } } },
    then: { properties: { port: { type: "integer", minimum: 1 }, logLevel: { enum: ["info", "error"] } } },
  }],
} as const;
export interface RuntimeConfig {
  readonly environment: "development" | "test" | "production";
  readonly host: "127.0.0.1" | "0.0.0.0" | "::1" | "::";
  readonly port: number;
  readonly bodyLimit: number;
  readonly shutdownTimeoutMs: number;
  readonly probeTimeoutMs: number;
  readonly logLevel: "info" | "error" | "silent";
  readonly modelAdapter: "disabled" | "test";
  readonly judgeAdapter: "disabled" | "test";
}

export const livenessSchema = {
  type: "object", additionalProperties: false, required: ["status"],
  properties: { status: { const: "alive" } },
} as const;
export const readinessSchema = {
  type: "object", additionalProperties: false, required: ["status", "scope", "capabilities"],
  properties: {
    status: { const: "ready" }, scope: { const: "api-foundation" },
    capabilities: { type: "object", additionalProperties: false, required: ["model", "judge"],
      properties: { model: { enum: ["disabled", "test"] }, judge: { enum: ["disabled", "test"] } },
    },
  },
} as const;
