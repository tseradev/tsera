import { Command } from "../deps/command.ts";
import type { GlobalCLIOptions } from "../router.ts";

interface InitCommandOptions extends GlobalCLIOptions {
  template: string;
  force: boolean;
  yes: boolean;
}

export interface InitCommandContext {
  directory: string;
  template: string;
  force: boolean;
  yes: boolean;
  global: GlobalCLIOptions;
}

export type InitCommandHandler = (context: InitCommandContext) => Promise<void> | void;

const DEFAULT_INIT_HANDLER: InitCommandHandler = (context) => {
  console.info("Initialisation du projet %s", context.directory);
  console.info("TODO(engine): générer tsera.config.ts et le squelette template.");
};

export function createInitCommand(
  handler: InitCommandHandler = DEFAULT_INIT_HANDLER,
): Command<InitCommandOptions> {
  return new Command<InitCommandOptions>()
    .description("Initialiser un nouveau projet TSera.")
    .arguments("[directory]")
    .option("--template <name:string>", "Nom du template à utiliser.", { default: "app-minimal" })
    .option("-f, --force", "Écraser les fichiers existants.", { default: false })
    .option("-y, --yes", "Répondre oui aux questions interactives.", { default: false })
    .action(async (options, directory = ".") => {
      const { json, strict, template, force, yes } = options;
      await handler({
        directory,
        template,
        force,
        yes,
        global: { json, strict },
      });
    });
}
