import { resolve } from "../../../shared/path.ts";
import { createLogger } from "../../utils/log.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import type { DeployProvider } from "../../definitions.ts";
import { readDeployTargets } from "../../utils/deploy-config.ts";
import {
  computeWorkflowsToGenerate,
  removeWorkflow,
  type SyncResult,
  syncWorkflow,
} from "./utils/workflow-sync.ts";
import { readWorkflowsMeta } from "./utils/workflow-meta.ts";
import { DeploySyncConsole } from "./deploy-sync-ui.ts";
import { AVAILABLE_PROVIDERS } from "./deploy-init-ui.ts";

/**
 * Context for the `tsera deploy sync` command.
 */
export type DeploySyncContext = {
  /** Project directory. */
  projectDir: string;
  /** Force overwrite even if files have been manually modified. */
  force: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
};

/**
 * Handler for the `tsera deploy sync` command.
 * Re-reads deployTargets from config/tsera.config.ts,
 * generates CD workflows for enabled providers,
 * removes workflows for disabled providers.
 *
 * @param context - Command context.
 */
export async function handleDeploySync(context: DeploySyncContext): Promise<void> {
  const { projectDir, force, global } = context;
  const jsonMode = global.json;
  const logger = createLogger({ json: jsonMode });

  const absoluteProjectDir = resolve(projectDir);
  const human = jsonMode ? undefined : new DeploySyncConsole({ projectDir: absoluteProjectDir });

  if (jsonMode) {
    logger.event("deploy:sync:start", { projectDir: absoluteProjectDir, force });
  } else {
    human?.start();
  }

  // 1. Read deployTargets (array) from config/tsera.config.ts
  const enabledProviders = await readDeployTargets(absoluteProjectDir);

  // 2. Read existing metadata
  const meta = await readWorkflowsMeta(absoluteProjectDir);

  // 3. List only CD workflows tracked by TSera (present in workflows-meta.json)
  // Note: Untracked cd-*.yml files (manually created) are never removed
  const trackedWorkflows = Object.keys(meta);

  // 4. Group workflows by provider for better display
  // Compute workflows per provider to maintain grouping
  const workflowsByProvider = new Map<
    DeployProvider,
    Array<{ sourcePath: string; targetPath: string }>
  >();

  for (const provider of enabledProviders) {
    const providerWorkflows = await computeWorkflowsToGenerate(
      absoluteProjectDir,
      [provider],
    );
    if (providerWorkflows.length > 0) {
      workflowsByProvider.set(provider, providerWorkflows);
    }
  }

  // Flatten for removal check and total count
  const workflowsToGenerate = Array.from(workflowsByProvider.values()).flat();

  // 5. Determine workflows to remove (disabled providers)
  // Only workflows tracked in workflows-meta.json can be removed
  const workflowsToRemove = trackedWorkflows.filter(
    (wf) => !workflowsToGenerate.some((w) => w.targetPath === wf),
  );

  // 7. Generate workflows grouped by provider
  const results: SyncResult[] = [];

  if (!jsonMode && workflowsToGenerate.length > 0) {
    human?.applyStart(workflowsToGenerate.length);
  }

  // Helper to get provider display name
  const getProviderName = (provider: DeployProvider): string => {
    const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.value === provider);
    return providerInfo?.label ?? provider;
  };

  // Process each provider group
  for (const [provider, workflows] of workflowsByProvider.entries()) {
    const providerName = getProviderName(provider);

    if (!jsonMode) {
      human?.startProvider(providerName);
    }

    for (const workflow of workflows) {
      const result = await syncWorkflow({
        projectDir: absoluteProjectDir,
        sourcePath: workflow.sourcePath,
        targetPath: workflow.targetPath,
        force,
      });
      results.push(result);

      if (jsonMode) {
        logSyncResult(workflow.targetPath, result, logger);
      } else {
        // workflow.targetPath is already relative (e.g., .github/workflows/cd-docker-prod.yml)
        // Pass it directly - the UI will handle it correctly
        if (result.action === "skipped") {
          human?.trackSkipped(workflow.targetPath);
        } else if (result.action === "conflict") {
          human?.trackConflict(workflow.targetPath);
        } else {
          human?.trackWorkflow(workflow.targetPath, result);
        }
      }
    }
  }

  // 8. Remove workflows for disabled providers
  // Note: Only workflows tracked in workflows-meta.json are removed
  // Untracked cd-*.yml files (manually created) are never removed
  // Group workflows to remove by provider for better display
  const workflowsToRemoveByProvider = new Map<DeployProvider, string[]>();

  for (const workflowPath of workflowsToRemove) {
    // Extract provider from workflow path: .github/workflows/cd-<provider>-<name>.yml
    const match = workflowPath.match(/cd-([^-]+)-/);
    if (match && match[1]) {
      const provider = match[1] as DeployProvider;
      if (!workflowsToRemoveByProvider.has(provider)) {
        workflowsToRemoveByProvider.set(provider, []);
      }
      workflowsToRemoveByProvider.get(provider)!.push(workflowPath);
    } else {
      // Fallback: if we can't extract provider, add to a special group
      if (!workflowsToRemoveByProvider.has("docker" as DeployProvider)) {
        workflowsToRemoveByProvider.set("docker" as DeployProvider, []);
      }
      workflowsToRemoveByProvider.get("docker" as DeployProvider)!.push(workflowPath);
    }
  }

  // Process removals grouped by provider
  for (const [provider, workflowPaths] of workflowsToRemoveByProvider.entries()) {
    const providerName = getProviderName(provider);

    if (!jsonMode && workflowPaths.length > 0) {
      human?.startProvider(providerName);
    }

    for (const workflowPath of workflowPaths) {
      await removeWorkflow(absoluteProjectDir, workflowPath);
      if (jsonMode) {
        logger.event("deploy:sync:removed", { workflow: workflowPath });
      } else {
        // workflowPath is already relative, pass it directly
        human?.trackRemoved(workflowPath);
      }
    }
  }

  // 9. Display summary
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const skipped = results.filter((r) => r.action === "skipped").length;
  const conflicts = results.filter((r) => r.action === "conflict").length;

  if (jsonMode) {
    logger.event("deploy:sync:done", {
      created,
      updated,
      skipped,
      conflicts,
      removed: workflowsToRemove.length,
    });
  } else {
    human?.complete({
      created,
      updated,
      skipped,
      conflicts,
      removed: workflowsToRemove.length,
    });
  }
}

/**
 * Logs the synchronization result of a workflow (JSON mode only).
 *
 * @param workflowPath - Workflow path.
 * @param result - Synchronization result.
 * @param logger - Logger to use.
 */
function logSyncResult(
  workflowPath: string,
  result: SyncResult,
  logger: ReturnType<typeof createLogger>,
): void {
  logger.event("deploy:sync:workflow", {
    workflow: workflowPath,
    action: result.action,
    reason: result.reason,
  });
}
