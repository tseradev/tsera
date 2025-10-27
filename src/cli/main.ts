#!/usr/bin/env -S deno run -A
import { createRouter } from "./router.ts";

export interface CliMetadata {
  version: string;
}

const DEFAULT_METADATA: CliMetadata = {
  version: "0.0.0-dev",
};

export async function main(
  args: string[] = Deno.args,
  metadata: CliMetadata = DEFAULT_METADATA,
): Promise<void> {
  const router = createRouter(metadata);
  router.throwErrors();

  try {
    await router.parse(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
