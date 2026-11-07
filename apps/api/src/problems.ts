import type { FastifyReply, FastifyRequest } from "fastify";
import type { FieldError, ProblemCode, ProblemDetails } from "@tracemigo/contracts";

const definitions: Record<ProblemCode, readonly [number, string]> = {
  INVALID_REQUEST: [422, "Invalid request"], MALFORMED_REQUEST: [400, "Malformed request"], MALFORMED_JSON: [400, "Malformed JSON"],
  PAYLOAD_TOO_LARGE: [413, "Payload too large"], UNSUPPORTED_MEDIA_TYPE: [415, "Unsupported media type"],
  NOT_FOUND: [404, "Not found"], NOT_IMPLEMENTED: [501, "Not implemented"],
  INTERNAL_ERROR: [500, "Internal server error"], NOT_READY: [503, "Service not ready"],
  SHUTTING_DOWN: [503, "Service shutting down"], FEATURE_UNAVAILABLE: [503, "Capability unavailable"],
  REQUEST_TIMEOUT: [408, "Request timeout"],
};
export function sendProblem(reply: FastifyReply, request: FastifyRequest, code: ProblemCode, fields?: readonly FieldError[]) {
  const [status, title] = definitions[code];
  const problem: ProblemDetails = {
    type: "about:blank", title, status, code, request_id: request.id,
    ...(fields ? { field_errors: fields.slice(0, 8) } : {}),
  };
  return reply.code(status).header("x-request-id", request.id).header("cache-control", "no-store").type("application/problem+json").send(problem);
}
