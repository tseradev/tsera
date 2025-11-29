import { dirname } from "../../../shared/path.ts";
import { Command } from "cliffy/command";
import { createLogger } from "../../utils/log.ts";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { applyPlan } from "../../engine/applier.ts";
import { createDag } from "../../engine/dag.ts";
import { prepareDagInputs } from "../../engine/entities.ts";
import { planDag } from "../../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../../engine/state.ts";
import { watchProject } from "../../engine/watch.ts";
import type { CliMetadata } from "../../main.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { DevConsole } from "./dev-ui.ts";
import { detectActiveModules } from "./modules.ts";
import { ProcessManager } from "./process-manager.ts";

/** CLI options accepted by the {@code dev} command. */
interface DevCommandOptions extends GlobalCLIOptions {
  apply: boolean;
  logs: boolean;
}

/** Options passed to the dev action handler by Cliffy. */
interface DevActionOptions {
  json?: boolean;
  apply?: boolean;
  logs?: boolean;
}

/**
 * Context object passed to dev command handlers.
 */
export interface DevCommandContext {
  /** Project root directory. */
  projectDir: string;
  /** Whether to force apply even if the plan is empty. */
  apply: boolean;
  /** Whether to show all module logs in real-time. */
  logs: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Function signature for dev command implementations.
 */
export type DevCommandHandler = (context: DevCommandContext) => Promise<void> | void;

const WATCH_DEBOUNCE_MS = 150;

/**
 * Creates the default dev command handler that orchestrates planning and applying the DAG.
 */
function createDefaultDevHandler(metadata: CliMetadata): DevCommandHandler {
  return async (context) => {
    const logger = createLogger({ json: context.global.json });
    const initial = await resolveConfig(context.projectDir);
    // projectRoot is the directory containing the config (which is in config/ subdirectory)
    // So we need to go up one level from config/tsera.config.ts to get the project root
    const projectRoot = dirname(dirname(initial.configPath));
    let queue = Promise.resolve();

    // Create UI console for human-friendly output (only if not JSON mode)
    const uiConsole = context.global.json ? null : new DevConsole({
      projectDir: projectRoot,
      watchEnabled: true, // dev command always uses watch mode
    });

    // Show initial banner
    if (uiConsole && !context.global.json) {
      uiConsole.start();
    }

    // Detect active modules and start process manager
    const activeModules = await detectActiveModules(projectRoot);
    const processManager = new ProcessManager();
    const configWatchPath = initial.configPath;

    // Helper function to build modules status summary
    const buildModulesStatus = (): Map<string, { status: string; url?: string }> => {
      const statusMap = new Map<string, { status: string; url?: string }>();
      if (activeModules.backend) {
        const status = processManager.getStatus("backend") || "stopped";
        const url = processManager.getUrl("backend");
        statusMap.set("backend", { status, url });
      }
      if (activeModules.frontend) {
        const status = processManager.getStatus("frontend") || "stopped";
        const url = processManager.getUrl("frontend");
        statusMap.set("frontend", { status, url });
      }
      return statusMap;
    };

    // Setup process status change handler
    processManager.onStatusChange((name, status, url) => {
      // Emit JSON events for module status changes
      if (context.global.json) {
        switch (status) {
          case "starting": {
            logger.event("module:starting", { name });
            break;
          }
          case "ready": {
            logger.event("module:ready", { name, url: url || null });
            // Emit modules status summary when a module becomes ready
            const readyStatus = buildModulesStatus();
            if (readyStatus.size > 0) {
              const statusObj: Record<string, { status: string; url?: string }> = {};
              for (const [moduleName, info] of readyStatus.entries()) {
                statusObj[moduleName] = info;
              }
              logger.event("modules:status", { modules: statusObj });
            }
            break;
          }
          case "error": {
            const errors = processManager.getErrors(name);
            const lastError = errors[errors.length - 1] || "Unknown error";
            logger.event("module:error", { name, error: lastError });
            break;
          }
        }
        return; // Don't show UI in JSON mode
      }

      // Show UI for human-friendly output
      if (!uiConsole) return;

      switch (status) {
        case "starting": {
          uiConsole.moduleStarting(name);
          break;
        }
        case "ready": {
          uiConsole.moduleReady(name, url);
          // Show summary when a module becomes ready
          const readyStatus = buildModulesStatus();
          if (readyStatus.size > 0) {
            uiConsole.modulesStatus(readyStatus);
          }
          break;
        }
        case "error": {
          const errors = processManager.getErrors(name);
          const lastError = errors[errors.length - 1] || "Unknown error";
          uiConsole.moduleError(name, lastError);
          break;
        }
      }
    });

    const runCycle = async (
      reason: string,
      paths: string[] = [],
    ): Promise<{ pending: boolean }> => {
      // Emit JSON events for machine consumption (only in JSON mode)
      if (context.global.json) {
        if (paths.length > 0) {
          logger.event("plan:start", { reason, paths });
        } else {
          logger.event("plan:start", { reason });
        }
      }

      // Show cycle start in UI (only in human mode)
      if (uiConsole) {
        uiConsole.cycleStart(reason, paths);
      }

      const { config } = await resolveConfig(projectRoot);
      const dagInputs = await prepareDagInputs(projectRoot, config);
      const dag = await createDag(dagInputs, { cliVersion: metadata.version });

      await writeDagState(projectRoot, dag);

      const state = await readEngineState(projectRoot);
      const plan = planDag(dag, state);

      // Emit plan summary (only in JSON mode)
      if (context.global.json) {
        logger.event("plan:summary", { ...plan.summary });
      }

      // Show plan summary in UI (only in human mode)
      if (uiConsole) {
        uiConsole.planSummary(plan.summary, plan.steps);
      }

      const shouldApply = plan.summary.changed || context.apply;
      let nextState = state;

      if (shouldApply) {
        nextState = await applyPlan(plan, state, {
          projectDir: projectRoot,
          onStep: (step, result) => {
            // Emit step events (only in JSON mode)
            if (context.global.json) {
              logger.event("apply:step", {
                id: step.node.id,
                kind: step.node.kind,
                action: step.kind,
                path: result.path ?? null,
                changed: result.changed,
              });
            }
          },
        });

        // Emit apply done (only in JSON mode)
        if (context.global.json) {
          logger.event("apply:done", {
            steps: plan.summary.total,
            changed: plan.summary.changed,
          });
        }

        // Show apply completion in UI (only in human mode)
        if (uiConsole) {
          uiConsole.applyComplete(plan.summary.total, plan.summary.changed);
        }
      }

      await writeEngineState(projectRoot, nextState);

      const pending = plan.summary.changed && !shouldApply;

      // Emit coherence event (only in JSON mode)
      if (context.global.json) {
        logger.event("coherence", {
          status: pending ? "pending" : "clean",
          pending,
          entities: dagInputs.length,
        });
      }

      // Show final coherence status in UI (only in human mode, and for initial/manual/watch)
      // Avoid duplicate messages: only show for initial/manual, or for watch cycles that actually changed something
      if (uiConsole && (reason === "initial" || reason === "manual")) {
        uiConsole.complete(
          pending ? "pending" : "clean",
          dagInputs.length,
          shouldApply && plan.summary.changed,
        );
        // Don't show modules status here - modules haven't started yet
      } else if (uiConsole && reason === "watch" && (shouldApply && plan.summary.changed)) {
        // For watch cycles, only show status if changes were actually applied
        const status = pending ? "pending" : "clean";
        uiConsole.complete(status, dagInputs.length, true);
      }

      return { pending };
    };

    // Helper function to check if any active modules have errors
    const hasModuleErrors = (): boolean => {
      if (activeModules.backend) {
        const status = processManager.getStatus("backend");
        if (status === "error") return true;
      }
      if (activeModules.frontend) {
        const status = processManager.getStatus("frontend");
        if (status === "error") return true;
      }
      return false;
    };

    const executeCycle = async (reason: string, paths: string[] = []): Promise<void> => {
      try {
        // Check if config file changed and restart modules if so
        if (paths.some((p) => p === configWatchPath)) {
          if (uiConsole) {
            uiConsole.configChanged();
          }

          // Stop and restart all modules
          await processManager.stopAll();

          if (activeModules.backend) {
            await processManager.startModule({
              name: "backend",
              command: "deno",
              args: ["run", "-A", "--unstable-kv", "--watch", "app/back/main.ts"],
              cwd: projectRoot,
              showLogs: context.logs,
            });
          }

          if (activeModules.frontend) {
            await processManager.startModule({
              name: "frontend",
              command: "deno",
              args: ["task", "dev:front"],
              cwd: projectRoot,
              showLogs: context.logs,
            });
          }
        }

        // Check for module errors before running the cycle
        if (hasModuleErrors()) {
          if (context.global.json) {
            logger.event("modules:errors", {
              message: "Module errors detected, skipping coherence check",
            });
          } else if (uiConsole) {
            uiConsole.moduleErrorsWarning();
            // Show that we're checking if all modules have failed
            uiConsole.checkingModulesStatus();
          }
          // Don't run the cycle, but also check if we should exit
          // (this will be handled by the check in the watch loop or final check)
          return;
        }

        await runCycle(reason, paths);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Emit error event (only in JSON mode)
        if (context.global.json) {
          logger.event("error", { message });
        }

        // Show error in UI (only in human mode)
        if (uiConsole) {
          uiConsole.cycleError(message);
        }
        // In watch mode, errors are logged but don't stop the watch loop
      }
    };

    // Execute initial cycle first (to show coherence status)
    // Variable to track periodic check interval (for cleanup)
    let periodicCheckInterval: number | null = null;

    // Helper to check if all modules are in error state or have failed
    const allModulesInError = (): boolean => {
      if (!activeModules.backend && !activeModules.frontend) return false;

      let hasActiveModule = false;
      let allFailed = true;
      let hasError = false;

      if (activeModules.backend) {
        const status = processManager.getStatus("backend");
        hasActiveModule = true;
        // If status is "ready", then not all failed
        if (status === "ready") {
          allFailed = false;
          return false; // Early return if any module is ready
        } // If status is "error", mark that we have at least one error
        else if (status === "error") {
          hasError = true;
        } // If status is "starting", we don't know yet
        else if (status === "starting") {
          allFailed = false; // Can't say all failed if one is still starting
        }
      }

      if (activeModules.frontend) {
        const status = processManager.getStatus("frontend");
        hasActiveModule = true;
        // If status is "ready", then not all failed
        if (status === "ready") {
          allFailed = false;
          return false; // Early return if any module is ready
        } // If status is "error", mark that we have at least one error
        else if (status === "error") {
          hasError = true;
        } // If status is "starting", we don't know yet
        else if (status === "starting") {
          allFailed = false; // Can't say all failed if one is still starting
        }
      }

      // If we have errors but not all modules have definitive status, return false
      // (we need to wait for all modules to have a definitive status)
      return hasActiveModule && allFailed && hasError;
    };

    // Helper to check if all modules have a definitive status (not starting)
    const allModulesHaveDefinitiveStatus = (): boolean => {
      if (!activeModules.backend && !activeModules.frontend) return true;

      let allDefinitive = true;
      if (activeModules.backend) {
        const status = processManager.getStatus("backend");
        if (status === "starting" || status === undefined) {
          allDefinitive = false;
        }
      }
      if (activeModules.frontend) {
        const status = processManager.getStatus("frontend");
        if (status === "starting" || status === undefined) {
          allDefinitive = false;
        }
      }
      return allDefinitive;
    };

    // Helper to check and exit if all modules have failed (used during watch and non-watch)
    // This version is more lenient: if we have errors and no ready modules after a delay,
    // we consider all failed even if some are still "starting"
    const checkAndExitIfAllFailed = async (waitTimeMs: number = 0): Promise<void> => {
      // If we've waited long enough, be more lenient in our check
      const isLenientCheck = waitTimeMs >= 3000; // After 3 seconds

      if (isLenientCheck) {
        // Check if we have at least one error and no ready modules
        const hasErrorModule =
          (activeModules.backend && processManager.getStatus("backend") === "error") ||
          (activeModules.frontend && processManager.getStatus("frontend") === "error");
        const hasReadyModule =
          (activeModules.backend && processManager.getStatus("backend") === "ready") ||
          (activeModules.frontend && processManager.getStatus("frontend") === "ready");

        // If we have errors, no ready modules, and all modules that have a definitive status are in error
        if (hasErrorModule && !hasReadyModule) {
          let allDefinitiveAreError = true;
          let hasAnyDefinitive = false;

          if (activeModules.backend) {
            const status = processManager.getStatus("backend");
            if (status !== "starting" && status !== undefined) {
              hasAnyDefinitive = true;
              if (status !== "error") {
                allDefinitiveAreError = false;
              }
            }
          }
          if (activeModules.frontend) {
            const status = processManager.getStatus("frontend");
            if (status !== "starting" && status !== undefined) {
              hasAnyDefinitive = true;
              if (status !== "error") {
                allDefinitiveAreError = false;
              }
            }
          }

          // If all modules with definitive status are in error, exit
          if (hasAnyDefinitive && allDefinitiveAreError) {
            const modulesStatus = buildModulesStatus();
            if (context.global.json) {
              const statusObj: Record<string, { status: string; url?: string }> = {};
              for (const [moduleName, info] of modulesStatus.entries()) {
                statusObj[moduleName] = info;
              }
              logger.event("modules:all-failed", { modules: statusObj });
            } else if (uiConsole) {
              uiConsole.stopSpinner();
              uiConsole.allModulesFailed(modulesStatus);
            }
            await processManager.stopAll();
            Deno.exit(1);
          }
        }
      } else {
        // Strict check: all modules must have definitive status and all be in error
        if (allModulesHaveDefinitiveStatus() && allModulesInError()) {
          const modulesStatus = buildModulesStatus();
          if (context.global.json) {
            const statusObj: Record<string, { status: string; url?: string }> = {};
            for (const [moduleName, info] of modulesStatus.entries()) {
              statusObj[moduleName] = info;
            }
            logger.event("modules:all-failed", { modules: statusObj });
          } else if (uiConsole) {
            uiConsole.stopSpinner();
            uiConsole.allModulesFailed(modulesStatus);
          }
          await processManager.stopAll();
          Deno.exit(1);
        }
      }
    };

    // Run initial cycle before starting modules
    await executeCycle("initial");

    // Display detected modules after coherence check
    if (activeModules.backend || activeModules.frontend) {
      if (context.global.json) {
        const modules: Record<string, boolean> = {};
        if (activeModules.backend) modules.backend = true;
        if (activeModules.frontend) modules.frontend = true;
        logger.event("modules:detected", { modules });
      } else if (uiConsole) {
        uiConsole.modulesSummary(activeModules);
      }
    }

    // Track when modules started to calculate wait time
    const modulesStartTime = Date.now();

    // Start backend module if active
    if (activeModules.backend) {
      await processManager.startModule({
        name: "backend",
        command: "deno",
        args: ["run", "-A", "--unstable-kv", "--watch", "app/back/main.ts"],
        cwd: projectRoot,
        showLogs: context.logs,
      });
    }

    // Start frontend module if active
    if (activeModules.frontend) {
      await processManager.startModule({
        name: "frontend",
        command: "deno",
        args: ["task", "dev:front"],
        cwd: projectRoot,
        showLogs: context.logs,
      });
    }

    // Emit watch start event (only in JSON mode)
    if (context.global.json) {
      logger.event("watch:start", { root: projectRoot, debounce: WATCH_DEBOUNCE_MS });
    }

    const controller = watchProject(projectRoot, (events) => {
      const paths = events.flatMap((event) => event.paths);
      queue = queue
        .then(async () => {
          await executeCycle("watch", paths);
          // Check if all modules failed after each cycle
          // Pass the elapsed time since modules started
          const elapsed = Date.now() - modulesStartTime;
          await checkAndExitIfAllFailed(elapsed);
        })
        .catch(() => {
          // Errors are already logged by executeCycle.
        });
      return queue;
    }, { debounceMs: WATCH_DEBOUNCE_MS });

    try {
      await queue;

      // Wait for modules to start and potentially fail
      // Check every 200ms for up to 4 seconds (20 checks)
      let checks = 0;
      const maxChecks = 20; // 20 * 200ms = 4 seconds
      let hasReadyModule = false;
      const minChecksForErrorDetection = 5; // ~1 second
      let errorWarningShown = false; // Track if we've shown the error warning

      while (checks < maxChecks) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        checks++;

        // Check if at least one module is ready
        hasReadyModule =
          (activeModules.backend && processManager.getStatus("backend") === "ready") ||
          (activeModules.frontend && processManager.getStatus("frontend") === "ready");

        if (hasReadyModule) {
          if (uiConsole && !context.global.json) {
            uiConsole.stopSpinner();
          }
          break; // At least one module is working, continue watching
        }

        // Check if we have at least one module in error
        const hasErrorModule =
          (activeModules.backend && processManager.getStatus("backend") === "error") ||
          (activeModules.frontend && processManager.getStatus("frontend") === "error");

        // Show warning when first error is detected (after minimum wait time)
        if (
          checks >= minChecksForErrorDetection && hasErrorModule && !hasReadyModule &&
          !errorWarningShown
        ) {
          if (uiConsole && !context.global.json) {
            uiConsole.moduleErrorsWarning();
            uiConsole.checkingModulesStatus();
            errorWarningShown = true;
          }
        }

        // After waiting at least 1 second, if we have errors and no ready modules,
        // check if all active modules have failed
        // We wait a bit to give modules time to start properly
        if (checks >= minChecksForErrorDetection && hasErrorModule && !hasReadyModule) {
          // Use the lenient check that considers modules failed even if some are still "starting"
          const elapsed = Date.now() - modulesStartTime;
          await checkAndExitIfAllFailed(elapsed);
          // If we didn't exit, continue checking
        }

        // Check if all modules have a definitive status (not starting)
        const allDefinitive = allModulesHaveDefinitiveStatus();

        // If all modules have definitive status, check if all failed
        if (allDefinitive) {
          // Show warning if we have errors but haven't shown it yet
          const hasErrorModule =
            (activeModules.backend && processManager.getStatus("backend") === "error") ||
            (activeModules.frontend && processManager.getStatus("frontend") === "error");

          if (hasErrorModule && !errorWarningShown) {
            if (uiConsole && !context.global.json) {
              uiConsole.moduleErrorsWarning();
              uiConsole.checkingModulesStatus();
              errorWarningShown = true;
            }
          }

          if (uiConsole && !context.global.json) {
            uiConsole.stopSpinner();
          }
          const elapsed = Date.now() - modulesStartTime;
          await checkAndExitIfAllFailed(elapsed);
          // If we didn't exit, break and continue watching
          // (maybe some modules are stopped but not in error)
          break;
        }
      }

      // Final check before continuing to watch
      // If we didn't find a ready module, check one more time if all failed
      if (!hasReadyModule) {
        // Check if we have errors but haven't shown warning yet
        const hasErrorModule =
          (activeModules.backend && processManager.getStatus("backend") === "error") ||
          (activeModules.frontend && processManager.getStatus("frontend") === "error");

        if (hasErrorModule && !errorWarningShown) {
          if (uiConsole && !context.global.json) {
            uiConsole.moduleErrorsWarning();
            uiConsole.checkingModulesStatus();
            errorWarningShown = true;
          }
        }

        if (uiConsole && !context.global.json) {
          uiConsole.stopSpinner();
        }
        // Wait a bit more to ensure all modules have had time to fail
        await new Promise((resolve) => setTimeout(resolve, 300));

        const elapsed = Date.now() - modulesStartTime;
        await checkAndExitIfAllFailed(elapsed);
      }

      // Set up periodic check during watch mode to detect if all modules fail later
      periodicCheckInterval = setInterval(async () => {
        const elapsed = Date.now() - modulesStartTime;
        await checkAndExitIfAllFailed(elapsed);
      }, 2000) as unknown as number; // Check every 2 seconds

      // Otherwise, wait indefinitely for file changes
      await new Promise<void>(() => { });
    } finally {
      if (periodicCheckInterval !== null) {
        clearInterval(periodicCheckInterval);
      }
      controller.close();
      await processManager.stopAll();
    }

    // Cleanup on exit
    const cleanup = async () => {
      if (periodicCheckInterval !== null) {
        clearInterval(periodicCheckInterval);
      }
      await processManager.stopAll();
      Deno.exit(0);
    };

    Deno.addSignalListener("SIGINT", cleanup);
    // SIGTERM is not supported on Windows, only add it on other platforms
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", cleanup);
    }
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera dev}.
 */
export function createDevCommand(
  metadata: CliMetadata,
  handler: DevCommandHandler = createDefaultDevHandler(metadata),
) {
  const command = new Command()
    .description("Watch entities, plan changes, and apply generated artifacts in development mode.")
    .arguments("[projectDir]")
    .option("--apply", "Force apply even if the plan is empty.", { default: false })
    .option("--logs", "Show all module logs in real-time.", { default: false })
    .action(async (options: DevActionOptions, projectDir = ".") => {
      const { json = false, apply = false, logs = false } = options;
      await handler({
        projectDir,
        apply,
        logs,
        global: { json },
      });
    });

  // Apply modern help rendering
  const originalShowHelp = command.showHelp.bind(command);
  command.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "dev",
          description:
            "Watch entities, plan changes, and apply generated artifacts in-place. Use for active development with automatic regeneration.",
          usage: "[projectDir]",
          options: [
            {
              label: "[projectDir]",
              description: "Project directory to watch (default: current directory)",
            },
            {
              label: "--apply",
              description: "Force apply artifacts even if the plan is empty",
            },
            {
              label: "--logs",
              description: "Show all module logs in real-time (backend, frontend)",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera dev",
            "tsera dev --logs",
            "tsera dev --json",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}
