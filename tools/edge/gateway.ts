export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  AI: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("OK", { status: 200 });
    }
    return new Response(JSON.stringify({ status: "live", service: "tracemigo-edge" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
