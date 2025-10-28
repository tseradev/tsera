import { Command } from "./deps/command.ts";
import { createDevCommand, type DevCommandHandler } from "./commands/dev.ts";
import { createDoctorCommand, type DoctorCommandHandler } from "./commands/doctor.ts";
import { createInitCommand, type InitCommandHandler } from "./commands/init.ts";
import { createUpdateCommand, type UpdateCommandHandler } from "./commands/update.ts";
import type { CliMetadata } from "./main.ts";

export interface GlobalCLIOptions extends Record<string, unknown> {
  json: boolean;
  strict: boolean;
}

export interface RouterHandlers {
  init?: InitCommandHandler;
  dev?: DevCommandHandler;
  doctor?: DoctorCommandHandler;
  update?: UpdateCommandHandler;
}

export function createRouter(
  metadata: CliMetadata,
  handlers: RouterHandlers = {},
): Command<GlobalCLIOptions> {
  const root = new Command<GlobalCLIOptions>()
    .name("tsera")
    .version(metadata.version)
    .description("TSera CLI — continuous coherence engine for entities.")
    .option("--json", "Enable machine-friendly NDJSON output.", {
      global: true,
      default: false,
    })
    .option("--strict", "Convert inconsistencies into exit code 2.", {
      global: true,
      default: false,
    });

  root.command("init", createInitCommand(handlers.init));
  root.command("dev", createDevCommand(metadata, handlers.dev));
  root.command("doctor", createDoctorCommand(handlers.doctor));
  root.command("update", createUpdateCommand(handlers.update));

  return root;
}
