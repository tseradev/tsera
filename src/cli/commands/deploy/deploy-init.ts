import type { GlobalCLIOptions } from "../../router.ts";
import { readDeployTargets, updateDeployTargets } from "../../utils/deploy-config.ts";
import { promptProviderSelection } from "./deploy-init-ui.ts";
import { handleDeploySync } from "./deploy-sync.ts";

/**
 * Context for the `tsera deploy init` command.
 */
export type DeployInitContext = {
  /** Project directory. */
  projectDir: string;
  /** Global CLI options. */
  global: GlobalCLIOptions;
};

/**
 * Handler for the `tsera deploy init` command.
 * Displays an interactive UI to select providers,
 * updates deployTargets in config/tsera.config.ts,
 * then calls `tsera deploy sync` to generate CD workflows.
 *
 * @param context - Command context.
 */
export async function handleDeployInit(context: DeployInitContext): Promise<void> {
  const { projectDir, global } = context;
  const jsonMode = global.json;

  if (jsonMode) {
    throw new Error("tsera deploy init requires interactive mode");
  }

  // 1. Read current configuration (if exists)
  const currentProviders = await readDeployTargets(projectDir);

  // 2. Display interactive UI
  const selectedProviders = await promptProviderSelection(currentProviders);

  // 3. Update deployTargets (array) in config/tsera.config.ts
  await updateDeployTargets(projectDir, selectedProviders);

  // 4. Call sync to generate workflows
  await handleDeploySync({
    projectDir,
    global,
    force: false,
  });
}
