import { requestIdPattern } from "@tracemigo/contracts";

const events = new Set(["request_completed", "request_failed", "startup_ready", "startup_failed", "shutdown_started", "shutdown_complete", "shutdown_failed"]);
const routes = new Set(["root", "liveness", "readiness", "not_found", "other"]);
const uuid = new RegExp(requestIdPattern);
export function createAuditLogger(write: (line: string) => void, level: "info" | "error" | "silent") {
  let available = true;
  return {
    available: () => available,
    record(event: string, fields: Readonly<Record<string, unknown>> = {}) {
      if (!events.has(event) || level === "silent" || (level === "error" && !event.endsWith("failed"))) return;
      // Projection drops every unrecognized field, including nested requests/errors.
      const output: Record<string, string | number> = { event };
      if (typeof fields["request_id"] === "string" && uuid.test(fields["request_id"])) output["request_id"] = fields["request_id"];
      if (typeof fields["status"] === "number" && Number.isInteger(fields["status"]) && fields["status"] >= 100 && fields["status"] <= 599) output["status"] = fields["status"];
      if (typeof fields["route"] === "string" && routes.has(fields["route"])) output["route"] = fields["route"];
      if (typeof fields["method"] === "string" && /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(fields["method"])) output["method"] = fields["method"];
      if (typeof fields["port"] === "number" && Number.isInteger(fields["port"]) && fields["port"] >= 0 && fields["port"] <= 65535) output["port"] = fields["port"];
      try { write(JSON.stringify(output) + "\n"); } catch { available = false; }
    },
  };
}
