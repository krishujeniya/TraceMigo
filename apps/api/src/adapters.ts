export class CapabilityUnavailable extends Error {
  constructor() { super("Capability is unavailable."); this.name = "CapabilityUnavailable"; }
}
export interface ModelAdapter {
  readonly kind: "disabled" | "test";
  generate(text: string): Promise<{ readonly kind: "test"; readonly text: string }>;
}
export interface JudgeAdapter {
  readonly kind: "disabled" | "test";
  execute(submissionHash: string): Promise<{ readonly kind: "test"; readonly observation: string }>;
}
export interface Adapters { readonly model: ModelAdapter; readonly judge: JudgeAdapter; close(): Promise<void> }
export function disabledAdapters(): Adapters {
  return {
    model: { kind: "disabled", async generate() { throw new CapabilityUnavailable(); } },
    judge: { kind: "disabled", async execute() { throw new CapabilityUnavailable(); } },
    async close() {},
  };
}
