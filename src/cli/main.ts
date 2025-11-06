#!/usr/bin/env -S deno run -A
import { createRouter } from "./router.ts";

/**
 * Metadata passed to the CLI entrypoint, primarily containing the published version.
 */
export interface CliMetadata {
  version: string;
}

const DEFAULT_METADATA: CliMetadata = {
  version: "0.0.0-dev",
};

/**
 * CLI entrypoint that constructs the command router and executes parsing logic.
 *
 * @param args - Command-line arguments, defaulting to {@link Deno.args}.
 * @param metadata - CLI metadata controlling version reporting.
 */
export async function main(
  args: string[] = Deno.args,
  metadata: CliMetadata = DEFAULT_METADATA,
): Promise<void> {
  const router = createRouter(metadata);
  router.throwErrors();

  try {
    // When no arguments are provided, show help by default
    if (args.length === 0) {
      router.showHelp();
      return;
    }

    await router.parse(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
