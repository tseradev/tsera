import type { Command as CommandPolyfill } from "./command.polyfill.ts";

let CommandImpl: typeof CommandPolyfill;

try {
  const cliffy = await import("jsr:@cliffy/command@1");
  CommandImpl = cliffy.Command as typeof CommandPolyfill;
} catch {
  const polyfill = await import("./command.polyfill.ts");
  CommandImpl = polyfill.Command;
}

export const Command = CommandImpl;
export type { CommandPolyfill as CommandType };
