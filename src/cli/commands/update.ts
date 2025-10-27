import { Command } from "../deps/command.ts";
import type { GlobalCLIOptions } from "../router.ts";

interface UpdateCommandOptions extends GlobalCLIOptions {
  channel: "stable" | "beta" | "canary";
  binary: boolean;
  dryRun: boolean;
}

export interface UpdateCommandContext {
  channel: "stable" | "beta" | "canary";
  binary: boolean;
  dryRun: boolean;
  global: GlobalCLIOptions;
}

export type UpdateCommandHandler = (context: UpdateCommandContext) => Promise<void> | void;

const DEFAULT_UPDATE_HANDLER: UpdateCommandHandler = (context) => {
  console.info("Mise à jour TSera (%s)", context.channel);
  console.info("TODO(engine): télécharger et mettre à jour le binaire / module selon les options.");
};

export function createUpdateCommand(
  handler: UpdateCommandHandler = DEFAULT_UPDATE_HANDLER,
): Command<UpdateCommandOptions> {
  return new Command<UpdateCommandOptions>()
    .description("Mettre à jour le CLI TSera via deno install ou binaire compilé.")
    .option("--channel <channel:string>", "Canal de release (stable|beta|canary).", {
      default: "stable",
      value: (value): "stable" | "beta" | "canary" => {
        if (value !== "stable" && value !== "beta" && value !== "canary") {
          throw new Error(`Canal inconnu: ${value}`);
        }
        return value;
      },
    })
    .option("--binary", "Installer le binaire compilé au lieu de deno install.", { default: false })
    .option("--dry-run", "Afficher les étapes sans appliquer.", { default: false })
    .action(async (options) => {
      const { json, strict, channel, binary, dryRun } = options;
      await handler({
        channel,
        binary,
        dryRun,
        global: { json, strict },
      });
    });
}
