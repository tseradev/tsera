import { dirname } from "../../../shared/path.ts";
import { Command } from "@cliffy/command";
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

/** CLI options accepted by the {@code dev} command. */
interface DevCommandOptions extends GlobalCLIOptions {
  watch: boolean;
  once: boolean;
  planOnly: boolean;
  apply: boolean;
}

/** Options passed to the dev action handler by Cliffy. */
interface DevActionOptions {
  json?: boolean;
  watch?: boolean;
  once?: boolean;
  planOnly?: boolean;
  apply?: boolean;
}

/**
 * Context object passed to dev command handlers.
 */
export interface DevCommandContext {
  /** Project root directory. */
  projectDir: string;
  /** Whether to watch for file changes. */
  watch: boolean;
  /** Whether to run a single cycle and exit. */
  once: boolean;
  /** Whether to compute the plan without applying it. */
  planOnly: boolean;
  /** Whether to force apply even if the plan is empty. */
  apply: boolean;
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
    const projectRoot = dirname(initial.configPath);
    const isWatchMode = context.watch && !context.once;
    let queue = Promise.resolve();

    const runCycle = async (
      reason: string,
      paths: string[] = [],
    ): Promise<{ pending: boolean }> => {
      if (paths.length > 0) {
        logger.event("plan:start", { reason, paths });
      } else {
        logger.event("plan:start", { reason });
      }

      const { config } = await resolveConfig(projectRoot);
      const dagInputs = await prepareDagInputs(projectRoot, config);
      const dag = await createDag(dagInputs, { cliVersion: metadata.version });

      await writeDagState(projectRoot, dag);

      const state = await readEngineState(projectRoot);
      const plan = planDag(dag, state);

      logger.event("plan:summary", { ...plan.summary });

      const shouldApply = !context.planOnly && (plan.summary.changed || context.apply);
      let nextState = state;

      if (shouldApply) {
        nextState = await applyPlan(plan, state, {
          projectDir: projectRoot,
          onStep: (step, result) => {
            logger.event("apply:step", {
              id: step.node.id,
              kind: step.node.kind,
              action: step.kind,
              path: result.path ?? null,
              changed: result.changed,
            });
          },
        });

        logger.event("apply:done", {
          steps: plan.summary.total,
          changed: plan.summary.changed,
        });
      }

      await writeEngineState(projectRoot, nextState);

      const pending = plan.summary.changed && !shouldApply;
      logger.event("coherence", {
        status: pending ? "pending" : "clean",
        pending,
        entities: dagInputs.length,
      });

      return { pending };
    };

    const executeCycle = async (reason: string, paths: string[] = []): Promise<void> => {
      try {
        await runCycle(reason, paths);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.event("error", { message });
        if (!context.global.json) {
          logger.error("cycle:failure", { message });
        }
        if (!isWatchMode) {
          throw error instanceof Error ? error : new Error(message);
        }
      }
    };

    if (isWatchMode) {
      logger.event("watch:start", { root: projectRoot, debounce: WATCH_DEBOUNCE_MS });
      const controller = watchProject(projectRoot, (events) => {
        const paths = events.flatMap((event) => event.paths);
        queue = queue
          .then(() => executeCycle("watch", paths))
          .catch(() => {
            // Errors are already logged by executeCycle.
          });
        return queue;
      }, { debounceMs: WATCH_DEBOUNCE_MS });

      try {
        await executeCycle("initial");
        await queue;
        await new Promise<void>(() => {});
      } finally {
        controller.close();
      }
    } else {
      await executeCycle("manual");
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
    .description("Plan and apply TSera artifacts in development mode.")
    .arguments("[projectDir]")
    .option("--no-watch", "Disable the file watcher (enabled by default).")
    .option("--once", "Run a single plan/apply cycle.", { default: false })
    .option("--plan-only", "Compute the plan without applying it.", { default: false })
    .option("--apply", "Force apply even if the plan is empty.", { default: false })
    .action(async (options: DevActionOptions, projectDir = ".") => {
      const { json = false, watch, once = false, planOnly = false, apply = false } = options;
      await handler({
        projectDir,
        watch: watch !== false, // watch is false only when --no-watch is explicitly used
        once,
        planOnly,
        apply,
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
          description: "Watch entities, plan changes, and apply generated artifacts in-place.",
          usage: "[projectDir]",
          options: [
            {
              label: "[projectDir]",
              description: "Project directory to watch (default: current directory)",
            },
            {
              label: "--no-watch",
              description: "Disable the file watcher (enabled by default)",
            },
            {
              label: "--once",
              description: "Run a single plan/apply cycle and exit",
            },
            {
              label: "--plan-only",
              description: "Compute the plan without applying changes (dry-run)",
            },
            {
              label: "--apply",
              description: "Force apply artifacts even if the plan is empty",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera dev",
            "tsera dev --once",
            "tsera dev --plan-only",
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
