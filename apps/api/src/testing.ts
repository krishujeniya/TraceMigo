/** Explicit fixture adapters, imported only by test code; never provider substitutes. */
import type { Adapters } from "./adapters.js";
export function createTestAdapters(): Adapters {
  return {
    model: { kind: "test", async generate() { return { kind: "test", text: "Synthetic test peer response." }; } },
    judge: { kind: "test", async execute() { return { kind: "test", observation: "Synthetic observation; no execution or score." }; } },
    async close() {},
  };
}
