import { resolve } from "../../../shared/path.ts";
import { createLogger } from "../../utils/log.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { readDeployTargets } from "../../utils/deploy-config.ts";
import {
  computeWorkflowsToGenerate,
  removeWorkflow,
  syncWorkflow,
  type SyncResult,
} from "./utils/workflow-sync.ts";
import { readWorkflowsMeta } from "./utils/workflow-meta.ts";

/**
 * Context for the `tsera deploy sync` command.
 */
export interface DeploySyncContext {
  /** Project directory. */
  projectDir: string;
  /** Force overwrite even if files have been manually modified. */
  force: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

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

  if (jsonMode) {
    logger.event("deploy:sync:start", { projectDir: absoluteProjectDir, force });
  }

  // 1. Read deployTargets (array) from config/tsera.config.ts
  const enabledProviders = await readDeployTargets(absoluteProjectDir);

  // 2. Read existing metadata
  const meta = await readWorkflowsMeta(absoluteProjectDir);

  // 3. List only CD workflows tracked by TSera (present in workflows-meta.json)
  // Note: Untracked cd-*.yml files (manually created) are never removed
  const trackedWorkflows = Object.keys(meta);

  // 4. Determine workflows to generate (based on enabled providers)
  const workflowsToGenerate = await computeWorkflowsToGenerate(
    absoluteProjectDir,
    enabledProviders,
  );

  // 5. Determine workflows to remove (disabled providers)
  // Only workflows tracked in workflows-meta.json can be removed
  const workflowsToRemove = trackedWorkflows.filter(
    (wf) => !workflowsToGenerate.some((w) => w.targetPath === wf),
  );

  // 6. Generate workflows for each enabled provider
  const results: SyncResult[] = [];

  for (const workflow of workflowsToGenerate) {
    const result = await syncWorkflow({
      projectDir: absoluteProjectDir,
      sourcePath: workflow.sourcePath,
      targetPath: workflow.targetPath,
      force,
    });
    results.push(result);
    logSyncResult(workflow.targetPath, result, jsonMode, logger);
  }

  // 7. Remove workflows for disabled providers
  // Note: Only workflows tracked in workflows-meta.json are removed
  // Untracked cd-*.yml files (manually created) are never removed
  for (const workflowPath of workflowsToRemove) {
    await removeWorkflow(absoluteProjectDir, workflowPath);
    if (jsonMode) {
      logger.event("deploy:sync:removed", { workflow: workflowPath });
    } else {
      logger.info(`Removed ${workflowPath}`);
    }
  }

  // 8. Display summary
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
    if (created > 0 || updated > 0 || workflowsToRemove.length > 0) {
      logger.info(
        `Deploy sync complete: ${created} created, ${updated} updated, ${workflowsToRemove.length} removed`,
      );
    }
    if (skipped > 0) {
      logger.warn(`${skipped} workflow(s) skipped (manually modified, use --force to overwrite)`);
    }
    if (conflicts > 0) {
      logger.error(
        `${conflicts} workflow(s) have conflicts (manually modified, use --force to overwrite)`,
      );
    }
  }
}

/**
 * Logs the synchronization result of a workflow.
 *
 * @param workflowPath - Workflow path.
 * @param result - Synchronization result.
 * @param jsonMode - JSON mode enabled.
 * @param logger - Logger to use.
 */
function logSyncResult(
  workflowPath: string,
  result: SyncResult,
  jsonMode: boolean,
  logger: ReturnType<typeof createLogger>,
): void {
  if (jsonMode) {
    logger.event("deploy:sync:workflow", {
      workflow: workflowPath,
      action: result.action,
      reason: result.reason,
    });
  } else {
    switch (result.action) {
      case "created":
        logger.info(`Created ${workflowPath}`);
        break;
      case "updated":
        if (result.reason?.includes("forced")) {
          logger.warn(`Updated ${workflowPath} (--force)`);
        } else {
          logger.info(`Updated ${workflowPath}`);
        }
        break;
      case "skipped":
        logger.warn(`Skipped ${workflowPath} (manually created, use --force to overwrite)`);
        break;
      case "conflict":
        logger.error(
          `Conflict ${workflowPath} (manually modified, use --force to overwrite)`,
        );
        break;
    }
  }
}

