#!/usr/bin/env -S deno run -A
/**
 * TSera CLI entrypoint. The command surface is intentionally lightweight for
 * now but the routing skeleton matches the Cliffy-based design described in
 * `AGENTS.md`.
 */

import { createRouter } from "./router.ts";

export async function main(argv = Deno.args): Promise<void> {
  const router = createRouter();
  await router.dispatch(argv);
}

if (import.meta.main) {
  main();
}
