import { Command } from "cliffy/command";
import { createDevCommand, type DevCommandHandler } from "./commands/dev/dev.ts";
import { createDoctorCommand, type DoctorCommandHandler } from "./commands/doctor/doctor.ts";
import { createInitCommand, type InitCommandHandler } from "./commands/init/init.ts";
import { createUpdateCommand, type UpdateCommandHandler } from "./commands/update/update.ts";
import { mcpCommand } from "./commands/mcp/mcp.ts";
import { createDeployCommand } from "./commands/deploy/deploy.ts";
import { applyModernHelp, type ModernHelpCommand } from "./commands/help/help.ts";
import type { CliMetadata } from "./main.ts";

/** A subcommand instance with global options applied. */
type SubCommand = ReturnType<typeof Command.prototype.globalOption>;

const CLI_NAME = "TSera";
const CLI_TAGLINE = "The next era of fullstack TypeScript starts here.";
const CLI_USAGE = "<command> [options]";
const JSON_OPTION_DESC = "Enable machine-readable NDJSON output.";

const GLOBAL_OPTION_HELP: ModernHelpCommand[] = [
  { label: "--json", description: JSON_OPTION_DESC },
  { label: "-h, --help", description: "Show this help message." },
  { label: "-v, -V, --version", description: "Display the CLI version." },
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
    label: "deploy <command>",
    description: "Manage Continuous Deployment (CD) workflows for multiple providers.",
  },
  {
    label: "update",
    description: "Upgrade the TSera CLI via deno install or compiled binaries.",
  },
  {
    label: "mcp",
    description: "Start the Model Context Protocol server for AI agents.",
  },
];

const CLI_EXAMPLES = [
  "tsera init demo-app",
  "tsera dev --json",
  "tsera doctor --fix",
];

/**
 * Global options shared across all CLI commands.
 */
export interface GlobalCLIOptions extends Record<string, unknown> {
  /** Enables machine-readable NDJSON output. */
  json: boolean;
}

/**
 * Optional hooks used to override command implementations in tests.
 */
export interface RouterHandlers {
  init?: InitCommandHandler;
  dev?: DevCommandHandler;
  doctor?: DoctorCommandHandler;
  deploy?: {
    init?: (
      context: import("./commands/deploy/deploy-init.ts").DeployInitContext,
    ) => Promise<void> | void;
    sync?: (
      context: import("./commands/deploy/deploy-sync.ts").DeploySyncContext,
    ) => Promise<void> | void;
  };
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
) {
  const root = new Command()
    .name(CLI_NAME)
    .description("TSera CLI — The next era of fullstack TypeScript starts here.")
    .globalOption("--json", JSON_OPTION_DESC, { default: false })
    .globalOption("-v, -V, --version", "Display the CLI version.", {
      override: true,
      action: () => {
        console.log(`TSera CLI ${metadata.version}`);
        Deno.exit(0);
      },
    });

  const withGlobalOpts = (cmd: SubCommand): SubCommand =>
    cmd.globalOption("--json", JSON_OPTION_DESC, { default: false, override: true });

  root.command("init", withGlobalOpts(createInitCommand(handlers.init)));
  root.command("dev", withGlobalOpts(createDevCommand(metadata, handlers.dev)));
  root.command("doctor", withGlobalOpts(createDoctorCommand(handlers.doctor)));
  root.command("deploy", withGlobalOpts(createDeployCommand(handlers.deploy)));
  root.command("update", withGlobalOpts(createUpdateCommand(handlers.update)));
  root.command("mcp", withGlobalOpts(mcpCommand));

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
