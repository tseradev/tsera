import { resolve } from "../../../shared/path.ts";
import { Command } from "cliffy/command";
import type { GlobalCLIOptions } from "../../router.ts";
import { handleDeployInit, type DeployInitContext } from "./deploy-init.ts";
import { handleDeploySync, type DeploySyncContext } from "./deploy-sync.ts";

/**
 * Context for deployment commands.
 */
export interface DeployCommandContext {
  /** Project directory (default: "."). */
  projectDir: string;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Handler for the `tsera deploy` command.
 */
export type DeployCommandHandler = (context: DeployCommandContext) => Promise<void> | void;

/**
 * Options for the init subcommand.
 */
interface DeployInitActionOptions {
  json?: boolean;
}

/**
 * Options for the sync subcommand.
 */
interface DeploySyncActionOptions {
  json?: boolean;
  force?: boolean;
}

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
    .description("Manage Continuous Deployment (CD) workflows for multiple providers");

  root
    .command("init")
    .description("Interactive configuration of deployment providers")
    .action(async (options) => {
      const opts = options as unknown as DeployInitActionOptions;
      const projectDir = resolve(".");
      await initHandler({
        projectDir,
        global: { json: opts.json ?? false },
      });
    });

  root
    .command("sync")
    .description("Synchronize CD workflows from config/cd/ to .github/workflows/")
    .option("--force", "Force overwrite of manually modified workflows", { default: false })
    .action(async (options) => {
      const opts = options as unknown as DeploySyncActionOptions;
      const projectDir = resolve(".");
      await syncHandler({
        projectDir,
        force: opts.force ?? false,
        global: { json: opts.json ?? false },
      });
    });

  return root;
}

