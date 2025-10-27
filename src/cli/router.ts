/**
 * Simple argument router that mimics the planned Cliffy command tree. The
 * implementation is intentionally framework-agnostic so we can iterate on the
 * command contracts before binding to Cliffy.
 */

import { doctorCommand } from "./commands/doctor.ts";
import { initCommand } from "./commands/init.ts";
import { devCommand } from "./commands/dev.ts";
import { updateCommand } from "./commands/update.ts";

export interface CliRouter {
  dispatch(args: readonly string[]): Promise<void>;
}

export function createRouter(): CliRouter {
  return {
    async dispatch(args) {
      const [command, ...rest] = args;
      switch (command) {
        case "init":
          await initCommand(rest);
          break;
        case "dev":
          await devCommand(rest);
          break;
        case "doctor":
          await doctorCommand(rest);
          break;
        case "update":
          await updateCommand(rest);
          break;
        case undefined:
        case "-h":
        case "--help":
          printHelp();
          break;
        default:
          console.error(`Commande inconnue: ${command}`);
          printHelp();
      }
    },
  };
}

function printHelp(): void {
  console.log(`TSera CLI\n\nCommandes disponibles:\n  init\n  dev\n  doctor\n  update`);
}
