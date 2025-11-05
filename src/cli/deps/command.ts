import type { Command as CommandPolyfill } from "./command.polyfill.ts";

// Dynamic import of Cliffy with fallback to polyfill
// Uses `unknown` internally but exports with correct types
let CommandImpl: unknown;

try {
  const cliffy = await import("jsr:@cliffy/command@1.0.0-rc.7");
  CommandImpl = cliffy.Command;
} catch {
  const polyfill = await import("./command.polyfill.ts");
  CommandImpl = polyfill.Command;
}

export const Command = CommandImpl as typeof CommandPolyfill;
export type { CommandPolyfill as CommandType };
