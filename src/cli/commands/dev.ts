/**
 * Placeholder for the `tsera dev` command.
 */

import type { CliContext } from "../engine/core/project.ts";

export async function devCommand(args: readonly string[], _ctx?: CliContext): Promise<void> {
  await Promise.resolve();
  const flags = args.join(" ");
  console.log(`Démarrage du mode dev TSera (placeholder). Flags: ${flags}`);
}
