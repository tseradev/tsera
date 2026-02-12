import { Command } from "cliffy/command";
import { resolve } from "../../../shared/path.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { type DeployInitContext, handleDeployInit } from "./deploy-init.ts";
import { type DeploySyncContext, handleDeploySync } from "./deploy-sync.ts";

/**
 * Context for deployment commands.
 */
export type DeployCommandContext = {
  /** Project directory (default: "."). */
  projectDir: string;
  /** Global CLI options. */
  global: GlobalCLIOptions;
};

/**
 * Handler for the `tsera deploy` command.
 */
export type DeployCommandHandler = (context: DeployCommandContext) => Promise<void> | void;

/**
 * Options for the init subcommand.
 * @internal
 */
type DeployInitActionOptions = {
  /** Enable JSON output mode. */
  json?: boolean;
};

/**
 * Options for the sync subcommand.
 * @internal
 */
type DeploySyncActionOptions = {
  /** Enable JSON output mode. */
  json?: boolean;
  /** Force overwrite of manually modified workflows. */
  force?: boolean;
};

/**
 * Creates the Cliffy `tsera deploy` command with its `init` and `sync` subcommands.
 *
 * @param handlers - Optional handlers for the subcommands.
 * @returns Configured Cliffy command.
 */
export function createDeployCommand(handlers: {
  init?: (context: DeployInitContext) => Promise<void> | void;
  sync?: (context: DeploySyncContext) => Promise<void> | void;
} = {}): Command {
  const initHandler = handlers.init ?? handleDeployInit;
  const syncHandler = handlers.sync ?? handleDeploySync;

  const root = new Command()
    .name("deploy")
    .description("Manage Continuous Deployment (CD) workflows for multiple providers")
    .action(() => {
      // When deploy is called without a subcommand, show help
      root.showHelp();
      Deno.exit(0);
    });

  // Apply modern help rendering
  const originalShowHelp = root.showHelp.bind(root);
  root.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "deploy",
          description: "Manage Continuous Deployment (CD) workflows for multiple providers.",
          usage: "<command>",
          commands: [
            {
              label: "init",
              description: "Interactive configuration of deployment providers",
            },
            {
              label: "sync",
              description: "Synchronize CD workflows from config/cd/ to .github/workflows/",
            },
          ],
          options: [
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera deploy init",
            "tsera deploy sync",
            "tsera deploy sync --force",
            "tsera deploy sync --json",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  root
    .command("init")
    .description("Interactive configuration of deployment providers")
    .option("--json", "Output machine-readable NDJSON events", { default: false })
    .action(async (options: DeployInitActionOptions) => {
      const projectDir = resolve(".");
      await initHandler({
        projectDir,
        global: { json: options.json ?? false },
      });
    });

  root
    .command("sync")
    .description("Synchronize CD workflows from config/cd/ to .github/workflows/")
    .option("--force", "Force overwrite of manually modified workflows", { default: false })
    .option("--json", "Output machine-readable NDJSON events", { default: false })
    .action(async (options: DeploySyncActionOptions) => {
      const projectDir = resolve(".");
      await syncHandler({
        projectDir,
        force: options.force ?? false,
        global: { json: options.json ?? false },
      });
    });

  return root;
}
