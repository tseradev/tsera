/**
 * Placeholder for the `tsera init` command. The final implementation will
 * scaffold a project configuration and template application.
 */

import type { CliContext } from "../engine/core/project.ts";

export async function initCommand(args: readonly string[], _ctx?: CliContext): Promise<void> {
  await Promise.resolve();
  const [target = "./app"] = args;
  console.log(`Initialisation du projet TSera dans ${target} (placeholder).`);
}
