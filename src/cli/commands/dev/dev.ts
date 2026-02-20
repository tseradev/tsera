import { Command } from "cliffy/command";
import { bootstrapEnv, type EnvName, isValidEnvName } from "../../../core/secrets.ts";
import { dirname } from "../../../shared/path.ts";
import { applyPlan } from "../../engine/applier.ts";
import { createDag } from "../../engine/dag.ts";
import { prepareDagInputs } from "../../engine/entities.ts";
import { planDag } from "../../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../../engine/state.ts";
import { watchProject } from "../../engine/watch.ts";
import type { CliMetadata } from "../../main.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { DevConsole, type ModuleStatus } from "./dev-ui.ts";
import { detectActiveModules } from "./modules.ts";
import { ProcessManager } from "./process-manager.ts";

/**
 * Options passed to the dev action handler by Cliffy.
 */
type DevActionOptions = {
  /** Whether to output JSON format */
  json?: boolean;
  /** Whether to force apply even if plan is empty */
  apply?: boolean;
  /** Whether to show module logs in real-time */
  logs?: boolean;
};

/**
 * Context object passed to dev command handlers.
 */
export type DevCommandContext = {
  /** Project root directory. */
  projectDir: string;
  /** Whether to force apply even if the plan is empty. */
  apply: boolean;
  /** Whether to show all module logs in real-time. */
  logs: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
};

/**
 * Function signature for dev command implementations.
 */
export type DevCommandHandler = (context: DevCommandContext) => Promise<void> | void;

/** Debounce delay in milliseconds for file watch events. */
const WATCH_DEBOUNCE_MS = 150;

/**
 * Resolves runtime environment name for secrets bootstrap.
 *
 * Priority:
 * 1. TSERA_ENV (strictly validated)
 * 2. NODE_ENV (best-effort mapping)
 * 3. "dev" fallback
 */
function resolveSecretsEnvName(): EnvName {
  const explicit = Deno.env.get("TSERA_ENV");
  if (explicit) {
    const resolved = normalizeEnvName(explicit);
    if (!resolved) {
      throw new Error(
        `Invalid TSERA_ENV "${explicit}". Expected one of: dev, staging, prod.`,
      );
    }
    return resolved;
  }

  const nodeEnv = Deno.env.get("NODE_ENV");
  const resolvedFromNodeEnv = nodeEnv ? normalizeEnvName(nodeEnv) : undefined;
  return resolvedFromNodeEnv ?? "dev";
}

/**
 * Maps raw env values to TSera environment names.
 */
function normalizeEnvName(value: string): EnvName | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "development") return "dev";
  if (normalized === "production") return "prod";
  if (normalized === "stage") return "staging";
  return isValidEnvName(normalized) ? normalized : undefined;
}

/**
 * Creates the default dev command handler that orchestrates planning and applying the DAG.
 *
 * @param metadata CLI metadata containing version information
 * @returns A dev command handler function
 */
function createDefaultDevHandler(metadata: CliMetadata): DevCommandHandler {
  return async (context) => {
    const initial = await resolveConfig(context.projectDir);
    // projectRoot is the directory containing the config (which is in config/ subdirectory)
    // So we need to go up one level from config/tsera.config.ts to get the project root
    const projectRoot = dirname(dirname(initial.configPath));

    try {
      Deno.chdir(projectRoot);
    } catch {
      // If chdir fails, continue without changing directory
    }

    const uiConsole = context.global.json ? null : new DevConsole({
      projectDir: projectRoot,
      watchEnabled: true,
      logsMode: context.logs,
    });

    if (uiConsole) {
      uiConsole.start();
    }

    // Detect active modules and start process manager
    const activeModules = await detectActiveModules(projectRoot);
    const processManager = new ProcessManager();
    const configWatchPath = initial.configPath;

    // Track module status
    const modulesStatus = new Map<string, ModuleStatus>();
    if (activeModules.secrets) modulesStatus.set("secrets", { status: "stopped" });
    if (activeModules.backend) modulesStatus.set("backend", { status: "stopped" });
    if (activeModules.frontend) modulesStatus.set("frontend", { status: "stopped" });

    const updateUI = (): void => {
      if (uiConsole && !context.logs) {
        uiConsole.renderModules(modulesStatus);
      }
    };

    const renderFinalState = (): void => {
      if (uiConsole) {
        uiConsole.renderModulesFinal(modulesStatus);
      }
    };

    const fatalExit = async (message: string): Promise<never> => {
      renderFinalState();
      if (uiConsole) {
        uiConsole.fatalError(message);
      } else {
        console.error(`Error: ${message}`);
      }
      try {
        const stopPromise = processManager.stopAll();
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 3000);
        });
        await Promise.race([stopPromise, timeoutPromise]);
      } catch {
        // Ignore errors during cleanup
      }
      Deno.exit(1);
    };

    if (uiConsole) {
      uiConsole.startCoherenceCheck();
    }

    try {
      const { config } = await resolveConfig(projectRoot);
      const dagInputs = await prepareDagInputs(projectRoot, config);
      const dag = await createDag(dagInputs, { cliVersion: metadata.version });
      await writeDagState(projectRoot, dag);
      const state = await readEngineState(projectRoot);
      const plan = planDag(dag, state);

      if (uiConsole) {
        if (plan.summary.changed && !context.apply) {
          uiConsole.coherenceFailure(dagInputs.length);
        } else {
          uiConsole.coherenceSuccess(dagInputs.length);
        }
      }
    } catch (error) {
      await fatalExit(
        `Coherence check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (activeModules.secrets) {
      modulesStatus.set("secrets", { status: "starting" });
      updateUI();

      try {
        const envName = resolveSecretsEnvName();
        await bootstrapEnv(envName, "config/secrets");

        modulesStatus.set("secrets", { status: "ready" });
        updateUI();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        modulesStatus.set("secrets", { status: "error", error: msg });
        updateUI();
        // Pass simplified message to avoid duplication - detailed error is already shown in module status
        await fatalExit("Secrets Manager failed");
      }
    }

    const checkAllModulesFinal = (): boolean => {
      for (const [name, status] of modulesStatus) {
        const shouldBeActive = (name === "secrets" && activeModules.secrets) ||
          (name === "backend" && activeModules.backend) ||
          (name === "frontend" && activeModules.frontend);
        if (shouldBeActive && status.status !== "ready" && status.status !== "error") {
          return false;
        }
      }
      return true;
    };

    // Setup Process Manager listeners
    processManager.onStatusChange((name, status, url) => {
      const current = modulesStatus.get(name);
      if (!current) return;

      const newStatus: ModuleStatus["status"] = status === "ready"
        ? "ready"
        : status === "error"
        ? "error"
        : status === "stopped"
        ? "stopped"
        : "starting";

      const errorMsg = status === "error" ? processManager.getErrors(name).pop() : undefined;

      modulesStatus.set(name, {
        status: newStatus,
        url: url,
        error: errorMsg,
      });
      updateUI();

      if (newStatus === "error") {
        fatalExit(`Module ${name} failed: ${errorMsg || "Unknown error"}`);
        return;
      }

      if (name === "backend" && newStatus === "ready" && activeModules.frontend) {
        const frontStatus = modulesStatus.get("frontend");
        if (frontStatus && frontStatus.status === "stopped") {
          modulesStatus.set("frontend", { status: "starting" });
          updateUI();
          processManager.startModule({
            name: "frontend",
            command: "deno",
            args: ["task", "dev:front"],
            cwd: projectRoot,
            showLogs: context.logs,
          }).catch((err) => {
            modulesStatus.set("frontend", { status: "error", error: String(err) });
            updateUI();
            fatalExit(`Failed to start frontend: ${err}`);
          });
        }
      }

      if (context.logs && uiConsole && checkAllModulesFinal()) {
        setTimeout(() => renderFinalState(), 100);
      }
    });

    if (activeModules.backend) {
      modulesStatus.set("backend", { status: "starting" });
      updateUI();

      await processManager.startModule({
        name: "backend",
        command: "deno",
        args: ["task", "dev:back"],
        cwd: projectRoot,
        showLogs: context.logs,
      });
    } else if (activeModules.frontend) {
      modulesStatus.set("frontend", { status: "starting" });
      updateUI();
      await processManager.startModule({
        name: "frontend",
        command: "deno",
        args: ["task", "dev:front"],
        cwd: projectRoot,
        showLogs: context.logs,
      });
    }

    // Watch for file changes
    const controller = watchProject(projectRoot, async (events: Array<{ paths: string[] }>) => {
      const paths = events.flatMap((event) => event.paths);

      if (paths.some((p) => p === configWatchPath)) {
        await fatalExit("Configuration changed. Please restart dev command.");
        return;
      }

      if (uiConsole) {
        uiConsole.cycleStart("watch", paths);
      }

      const { config } = await resolveConfig(projectRoot);
      const dagInputs = await prepareDagInputs(projectRoot, config);
      const dag = await createDag(dagInputs, { cliVersion: metadata.version });
      await writeDagState(projectRoot, dag);
      const state = await readEngineState(projectRoot);
      const plan = planDag(dag, state);

      if (uiConsole) {
        uiConsole.planSummary(plan.summary);
      }

      if (plan.summary.changed) {
        const nextState = await applyPlan(plan, state, {
          projectDir: projectRoot,
          onStep: () => {},
        });
        await writeEngineState(projectRoot, nextState);
        if (uiConsole) {
          uiConsole.applyComplete(plan.summary.total, true);
        }
      } else if (uiConsole) {
        uiConsole.applyComplete(0, false);
      }

      updateUI();
    }, { debounceMs: WATCH_DEBOUNCE_MS });

    // Keep alive - wait indefinitely for SIGINT or cleanup
    await new Promise<never>((_resolve, _reject) => {
      // This promise never resolves intentionally
      // The process will be terminated by SIGINT or fatalExit
    });

    // Cleanup (unreachable in normal flow, but here for completeness)
    controller.close();
    await processManager.stopAll();
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera dev}.
 *
 * @param metadata CLI metadata containing version information
 * @param handler Optional custom handler (defaults to createDefaultDevHandler)
 * @returns Configured Cliffy Command instance
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
