import Fastify from "fastify";
import { livenessSchema, readinessSchema } from "@tracemigo/contracts";
import type { FastifyInstance, FastifyRequest, FastifyError } from "fastify";
import { randomUUID } from "node:crypto";
import { ConfigurationError, parseConfiguration } from "./config.js";
import { createAuditLogger } from "./observability.js";
import { CapabilityUnavailable, disabledAdapters } from "./adapters.js";
import type { Adapters } from "./adapters.js";
import { sendProblem } from "./problems.js";

export { ConfigurationError, parseConfiguration } from "./config.js";
export { CapabilityUnavailable } from "./adapters.js";
export interface DependencyCheck { readonly check: (signal: AbortSignal) => Promise<boolean> }
export interface ServiceOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly writeLog?: (line: string) => void;
  readonly dependencies?: readonly DependencyCheck[];
  readonly testAdapters?: Adapters;
  readonly testRoutes?: (app: FastifyInstance) => void;
}
export function createService(options: ServiceOptions = {}) {
  const config = parseConfiguration(options.environment ?? process.env);
  if (process.env["NODE_ENV"] === "production" && config.environment !== "production") throw new ConfigurationError();
  if (config.environment !== "test" && (options.testAdapters || options.testRoutes)) throw new ConfigurationError();
  const usesTest = config.modelAdapter === "test" || config.judgeAdapter === "test";
  if (usesTest && !options.testAdapters) throw new ConfigurationError();
  if (!usesTest && options.testAdapters) throw new ConfigurationError();
  if (config.modelAdapter === "test" && (options.testAdapters?.model.kind !== "test" || typeof options.testAdapters.model.generate !== "function")) throw new ConfigurationError();
  if (config.judgeAdapter === "test" && (options.testAdapters?.judge.kind !== "test" || typeof options.testAdapters.judge.execute !== "function")) throw new ConfigurationError();
  const disabled = disabledAdapters();
  const adapters: Adapters = Object.freeze({
    model: config.modelAdapter === "test" ? options.testAdapters!.model : disabled.model,
    judge: config.judgeAdapter === "test" ? options.testAdapters!.judge : disabled.judge,
    close: async () => { if (usesTest) await options.testAdapters!.close(); },
  });
  const dependencies = [...(options.dependencies ?? [])];
  if (dependencies.length > 8 || dependencies.some(item => typeof item.check !== "function")) throw new ConfigurationError();
  const audit = createAuditLogger(options.writeLog ?? (line => { process.stdout.write(line); }), config.logLevel);
  const app = Fastify({
    logger: false, requestIdHeader: false, genReqId: () => randomUUID(),
    bodyLimit: config.bodyLimit, forceCloseConnections: "idle", return503OnClosing: false,
    connectionTimeout: 15000, requestTimeout: 15000,
    frameworkErrors(error, request, reply) {
      return sendProblem(reply, request, error.code === "FST_ERR_BAD_URL" ? "MALFORMED_REQUEST" : "INTERNAL_ERROR");
    },
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false, allErrors: false } },
  });
  const active = new Set<FastifyRequest>();
  const drained = new Set<() => void>();
  let draining = false;
  let pendingProbe: Promise<boolean> | undefined;
  let closing: Promise<void> | undefined;
  const routeName = (request: FastifyRequest) => {
    switch (request.routeOptions.url) {
      case "/": return "root";
      case "/v1/health/live": return "liveness";
      case "/v1/health/ready": return "readiness";
      default: return "other";
    }
  };
  const finished = (request: FastifyRequest) => {
    active.delete(request);
    if (active.size === 0) { for (const resolve of drained) resolve(); drained.clear(); }
  };
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id).header("cache-control", "no-store");
    if (draining) return sendProblem(reply.header("connection", "close"), request, "SHUTTING_DOWN");
    active.add(request);
  });
  app.addHook("onResponse", async (request, reply) => {
    audit.record("request_completed", { request_id: request.id, status: reply.statusCode, route: routeName(request), method: request.method });
    finished(request);
  });
  app.addHook("onRequestAbort", async request => { finished(request); });
  app.addHook("onTimeout", async request => { finished(request); });
  app.addHook("preClose", async () => { draining = true; });
  app.addHook("onClose", async () => { await adapters.close(); });
  app.setErrorHandler((error, request, reply) => {
    audit.record("request_failed", { request_id: request.id, route: routeName(request), method: request.method });
    const failure = error instanceof Error ? error as FastifyError : undefined;
    if (failure?.validation) return sendProblem(reply, request, "INVALID_REQUEST", [{ field: "body", code: "INVALID_VALUE" }]);
    if (failure?.code === "FST_ERR_CTP_INVALID_JSON_BODY" || failure?.code === "FST_ERR_CTP_EMPTY_JSON_BODY") return sendProblem(reply, request, "MALFORMED_JSON");
    if (failure?.code === "FST_ERR_CTP_BODY_TOO_LARGE") return sendProblem(reply, request, "PAYLOAD_TOO_LARGE");
    if (failure?.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return sendProblem(reply, request, "UNSUPPORTED_MEDIA_TYPE");
    if (error instanceof CapabilityUnavailable) return sendProblem(reply, request, "FEATURE_UNAVAILABLE");
    return sendProblem(reply, request, "INTERNAL_ERROR");
  });
  app.setNotFoundHandler((request, reply) => sendProblem(reply, request, "NOT_FOUND"));
  app.get("/", (request, reply) => sendProblem(reply, request, "NOT_IMPLEMENTED"));
  app.get("/v1/health/live", { schema: { response: { 200: livenessSchema } } }, async () => ({ status: "alive" }));
  async function probe(): Promise<boolean> {
    if (draining || !audit.available()) return false;
    if (pendingProbe) return pendingProbe;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<boolean>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(false); }, config.probeTimeoutMs);
    });
    const checks = Promise.all(dependencies.map(item => Promise.resolve().then(() => item.check(controller.signal)))).then(values => values.every(value => value === true), () => false);
    const outcome = Promise.race([checks, deadline]).then(ok => ok && !draining && audit.available());
    pendingProbe = outcome;
    // A timed-out check that ignores cancellation must not accumulate new work.
    void checks.finally(() => {
      if (timer) clearTimeout(timer);
      if (pendingProbe === outcome) pendingProbe = undefined;
    });
    return outcome;
  }
  app.get("/v1/health/ready", { schema: { response: { 200: readinessSchema } } }, async (request, reply) => {
    if (!await probe()) return sendProblem(reply, request, "NOT_READY");
    return { status: "ready", scope: "api-foundation", capabilities: { model: adapters.model.kind, judge: adapters.judge.kind } };
  });
  options.testRoutes?.(app);
  const beginDrain = () => { draining = true; };
  function shutdown(): Promise<void> {
    if (closing) return closing;
    beginDrain();
    audit.record("shutdown_started");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        app.server.closeAllConnections();
        void app.close().catch(() => {});
        reject(new Error("Service shutdown exceeded its deadline."));
      }, config.shutdownTimeoutMs);
    });
    const drainAndClose = async () => {
      if (active.size) await new Promise<void>(resolve => { drained.add(resolve); });
      await app.close();
    };
    closing = Promise.race([drainAndClose(), deadline]).then(() => {
      audit.record("shutdown_complete");
    }, () => {
      audit.record("shutdown_failed");
      throw new Error("Service shutdown failed.");
    }).finally(() => { if (timer) clearTimeout(timer); });
    return closing;
  }
  return { app, config, adapters, audit, beginDrain, shutdown };
}
export function createServer(options: ServiceOptions = {}) { return createService(options).app; }
