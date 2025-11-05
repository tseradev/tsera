import { Command, type CommandType } from "./deps/command.ts";
import { createDevCommand, type DevCommandHandler } from "./commands/dev.ts";
import { createDoctorCommand, type DoctorCommandHandler } from "./commands/doctor.ts";
import { createInitCommand, type InitCommandHandler } from "./commands/init.ts";
import { createUpdateCommand, type UpdateCommandHandler } from "./commands/update.ts";
import type { CliMetadata } from "./main.ts";
import { applyModernHelp, type ModernHelpCommand } from "./lib/help.ts";

const CLI_NAME = "tsera";
const CLI_TAGLINE = "Continuous coherence engine for entities.";
const CLI_USAGE = "<command> [options]";

const GLOBAL_OPTION_HELP: ModernHelpCommand[] = [
  { label: "--json", description: "Stream machine-readable NDJSON events." },
  { label: "--strict", description: "Treat inconsistencies as fatal (exit code 2)." },
  { label: "-h, --help", description: "Show this help message." },
  { label: "-V, --version", description: "Display the CLI version." },
];

const COMMAND_HELP: ModernHelpCommand[] = [
  {
    label: "init [directory]",
    description: "Scaffold a TSera project from a template and bootstrap artifacts.",
  },
  {
    label: "dev",
    description: "Watch entities, plan changes, and apply generated artifacts in-place.",
  },
  {
    label: "doctor",
    description: "Inspect project coherence, highlight issues, and offer safe fixes.",
  },
  {
    label: "update",
    description: "Upgrade the TSera CLI via deno install or compiled binaries.",
  },
];

const CLI_EXAMPLES = [
  "tsera init demo-app --template app-minimal",
  "tsera dev --json",
  "tsera doctor --strict",
];

/**
 * Injects global DX flags into a subcommand so they work before or after the command name.
 */
function withGlobalOptions<TOptions extends GlobalCLIOptions>(
  command: CommandType<TOptions>,
): CommandType<TOptions> {
  return command
    .globalOption("--json", "Enable machine-friendly NDJSON output.", { default: false })
    .globalOption("--strict", "Convert inconsistencies into exit code 2.", { default: false });
}

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
    .name(CLI_NAME)
    .version(metadata.version)
    .description("TSera CLI — continuous coherence engine for entities.")
    .globalOption("--json", "Enable machine-friendly NDJSON output.", {
      default: false,
    })
    .globalOption("--strict", "Convert inconsistencies into exit code 2.", {
      default: false,
    });

  root.command("init", withGlobalOptions(createInitCommand(handlers.init)));
  root.command("dev", withGlobalOptions(createDevCommand(metadata, handlers.dev)));
  root.command("doctor", withGlobalOptions(createDoctorCommand(handlers.doctor)));
  root.command("update", withGlobalOptions(createUpdateCommand(handlers.update)));

  root.action(() => {
    root.showHelp();
  });

  applyModernHelp(root, {
    cliName: CLI_NAME,
    version: metadata.version,
    tagline: CLI_TAGLINE,
    usage: CLI_USAGE,
    commands: COMMAND_HELP,
    globalOptions: GLOBAL_OPTION_HELP,
    examples: CLI_EXAMPLES,
  });

  return root;
}
