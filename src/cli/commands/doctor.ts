import { Command } from "../deps/command.ts";
import type { GlobalCLIOptions } from "../router.ts";

interface DoctorCommandOptions extends GlobalCLIOptions {
  cwd: string;
  fix: boolean;
}

export interface DoctorCommandContext {
  cwd: string;
  fix: boolean;
  global: GlobalCLIOptions;
}

export type DoctorCommandHandler = (context: DoctorCommandContext) => Promise<void> | void;

const DEFAULT_DOCTOR_HANDLER: DoctorCommandHandler = (context) => {
  console.info("Diagnostic du projet dans %s", context.cwd);
  console.info("TODO(engine): exécuter les checks de cohérence et appliquer --fix si demandé.");
};

export function createDoctorCommand(
  handler: DoctorCommandHandler = DEFAULT_DOCTOR_HANDLER,
): Command<DoctorCommandOptions> {
  return new Command<DoctorCommandOptions>()
    .description("Vérifier la cohérence du projet et proposer des corrections sûres.")
    .option("--cwd <path:string>", "Chemin du projet à diagnostiquer.", { default: "." })
    .option("--fix", "Appliquer automatiquement les corrections sûres.", { default: false })
    .action(async (options) => {
      const { json, strict, cwd, fix } = options;
      await handler({
        cwd,
        fix,
        global: { json, strict },
      });
    });
}
