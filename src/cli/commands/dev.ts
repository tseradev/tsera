import { Command } from "../deps/command.ts";
import type { GlobalCLIOptions } from "../router.ts";

interface DevCommandOptions extends GlobalCLIOptions {
  watch: boolean;
  once: boolean;
  planOnly: boolean;
  apply: boolean;
}

export interface DevCommandContext {
  projectDir: string;
  watch: boolean;
  once: boolean;
  planOnly: boolean;
  apply: boolean;
  global: GlobalCLIOptions;
}

export type DevCommandHandler = (context: DevCommandContext) => Promise<void> | void;

const DEFAULT_DEV_HANDLER: DevCommandHandler = (context) => {
  console.info("Démarrage du cycle dev sur %s", context.projectDir);
  console.info("TODO(engine): orchestrer watch → planner → applier.");
};

export function createDevCommand(
  handler: DevCommandHandler = DEFAULT_DEV_HANDLER,
): Command<DevCommandOptions> {
  return new Command<DevCommandOptions>()
    .description("Planifier et appliquer les artefacts TSera en mode développement.")
    .arguments("[projectDir]")
    .option("--watch", "Active le watcher de fichiers.", { default: true, negatable: true })
    .option("--once", "Exécuter un cycle unique plan/apply.", { default: false })
    .option("--plan-only", "Ne calculer que le plan sans appliquer.", { default: false })
    .option("--apply", "Forcer l'application même si le plan est vide.", { default: false })
    .action(async (options, projectDir = ".") => {
      const { json, strict, watch, once, planOnly, apply } = options;
      await handler({
        projectDir,
        watch,
        once,
        planOnly,
        apply,
        global: { json, strict },
      });
    });
}
