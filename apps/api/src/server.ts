import { createService } from "./index.js";

async function main() {
  let service: ReturnType<typeof createService>;
  try { service = createService(); }
  catch {
    console.error(JSON.stringify({ event: "configuration_invalid" }));
    process.exitCode = 1;
    return;
  }
  const stop = () => {
    void service.shutdown().catch(() => { process.exitCode = 1; });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await service.app.listen({ host: service.config.host, port: service.config.port });
    const address = service.app.server.address();
    service.audit.record("startup_ready", { port: typeof address === "object" && address ? address.port : service.config.port });
  } catch {
    service.audit.record("startup_failed");
    process.exitCode = 1;
    await service.shutdown().catch(() => {});
  }
}
await main();
