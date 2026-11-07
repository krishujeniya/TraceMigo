import type { RuntimeConfig } from "@tracemigo/contracts";

type Environment = Readonly<Record<string, string | undefined>>;
const allowed = new Set(["TRACEMIGO_HOST", "TRACEMIGO_PORT", "TRACEMIGO_BODY_LIMIT", "TRACEMIGO_SHUTDOWN_TIMEOUT_MS", "TRACEMIGO_PROBE_TIMEOUT_MS", "TRACEMIGO_LOG_LEVEL", "TRACEMIGO_MODEL_ADAPTER", "TRACEMIGO_JUDGE_ADAPTER"]);
export class ConfigurationError extends Error {
  constructor() { super("Invalid API configuration."); this.name = "ConfigurationError"; }
}
function choice<T extends string>(value: string | undefined, values: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!values.includes(value as T)) throw new ConfigurationError();
  return value as T;
}
function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new ConfigurationError();
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new ConfigurationError();
  return result;
}
export function parseConfiguration(env: Environment): RuntimeConfig {
  if (Object.keys(env).some(key => key.startsWith("TRACEMIGO_") && !allowed.has(key))) throw new ConfigurationError();
  const environment = choice(env["NODE_ENV"], ["development", "test", "production"], "development");
  const config: RuntimeConfig = {
    environment,
    host: choice(env["TRACEMIGO_HOST"], ["127.0.0.1", "0.0.0.0", "::1", "::"], "127.0.0.1"),
    port: integer(env["TRACEMIGO_PORT"], 3001, environment === "production" ? 1 : 0, 65535),
    bodyLimit: integer(env["TRACEMIGO_BODY_LIMIT"], 131072, 1024, 131072),
    shutdownTimeoutMs: integer(env["TRACEMIGO_SHUTDOWN_TIMEOUT_MS"], 10000, 100, 30000),
    probeTimeoutMs: integer(env["TRACEMIGO_PROBE_TIMEOUT_MS"], 500, 10, 5000),
    logLevel: choice(env["TRACEMIGO_LOG_LEVEL"], ["info", "error", "silent"], "info"),
    modelAdapter: choice(env["TRACEMIGO_MODEL_ADAPTER"], ["disabled", "test"], "disabled"),
    judgeAdapter: choice(env["TRACEMIGO_JUDGE_ADAPTER"], ["disabled", "test"], "disabled"),
  };
  if (environment !== "test" && (config.modelAdapter !== "disabled" || config.judgeAdapter !== "disabled")) throw new ConfigurationError();
  if (environment === "production" && config.logLevel === "silent") throw new ConfigurationError();
  return Object.freeze(config);
}
