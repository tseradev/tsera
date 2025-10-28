import { Command, type CommandType } from "./deps/command.ts";
import { createDevCommand, type DevCommandHandler } from "./commands/dev.ts";
import { createDoctorCommand, type DoctorCommandHandler } from "./commands/doctor.ts";
import { createInitCommand, type InitCommandHandler } from "./commands/init.ts";
import { createUpdateCommand, type UpdateCommandHandler } from "./commands/update.ts";
import type { CliMetadata } from "./main.ts";

/** Global options shared across CLI commands. */
export interface GlobalCLIOptions extends Record<string, unknown> {
  json: boolean;
  strict: boolean;
}

/** Optional hooks used to override command implementations in tests. */
export interface RouterHandlers {
  init?: InitCommandHandler;
  dev?: DevCommandHandler;
  doctor?: DoctorCommandHandler;
  update?: UpdateCommandHandler;
}

/**
 * Constructs the root Cliffy command with all TSera subcommands attached.
 *
 * @param metadata - CLI metadata, primarily providing the version string.
 * @param handlers - Optional overrides for individual command handlers.
 * @returns A configured Cliffy {@link Command} ready for parsing.
 */
export function createRouter(
  metadata: CliMetadata,
  handlers: RouterHandlers = {},
): CommandType<GlobalCLIOptions> {
  const root = new Command<GlobalCLIOptions>()
    .name("tsera")
    .version(metadata.version)
    .description("TSera CLI — continuous coherence engine for entities.")
    .globalOption("--json", "Enable machine-friendly NDJSON output.", {
      default: false,
    })
    .globalOption("--strict", "Convert inconsistencies into exit code 2.", {
      default: false,
    });

  root.command("init", createInitCommand(handlers.init));
  root.command("dev", createDevCommand(metadata, handlers.dev));
  root.command("doctor", createDoctorCommand(handlers.doctor));
  root.command("update", createUpdateCommand(handlers.update));

  root.action(() => {
    root.showHelp();
  });

  return root;
}
