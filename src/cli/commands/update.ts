/**
 * Placeholder for the `tsera update` command.
 */

import type { CliContext } from "../engine/core/project.ts";

export async function updateCommand(args: readonly string[], _ctx?: CliContext): Promise<void> {
  await Promise.resolve();
  const channel = args[0] ?? "stable";
  console.log(`Mise à jour de TSera vers le canal ${channel} (placeholder).`);
}
