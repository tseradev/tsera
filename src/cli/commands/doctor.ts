/**
 * Placeholder for the `tsera doctor` command.
 */

import type { CliContext } from "../engine/core/project.ts";

export async function doctorCommand(args: readonly string[], _ctx?: CliContext): Promise<void> {
  await Promise.resolve();
  const fix = args.includes("--fix");
  console.log(`Analyse de l'état du projet (placeholder). Option --fix: ${fix}`);
}
