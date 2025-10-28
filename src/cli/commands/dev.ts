import { dirname } from "../../shared/path.ts";
import { Command } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { resolveConfig } from "../core/resolve-config.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import { watchProject } from "../engine/watch.ts";
import type { CliMetadata } from "../main.ts";
import type { GlobalCLIOptions } from "../router.ts";

interface DevCommandOptions extends GlobalCLIOptions {
  watch: boolean;
  once: boolean;
  planOnly: boolean;
  apply: boolean;
}

export interface DevCommandContext {
  projectDir: string;
  watch: boolean;
  once: boolean;
  planOnly: boolean;
  apply: boolean;
  global: GlobalCLIOptions;
}

export type DevCommandHandler = (context: DevCommandContext) => Promise<void> | void;

const WATCH_DEBOUNCE_MS = 150;

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
        const result = await runCycle(reason, paths);
        if (context.global.strict && result.pending) {
          Deno.exit(2);
        }
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

export function createDevCommand(
  metadata: CliMetadata,
  handler: DevCommandHandler = createDefaultDevHandler(metadata),
): Command<DevCommandOptions> {
  return new Command<DevCommandOptions>()
    .description("Plan and apply TSera artifacts in development mode.")
    .arguments("[projectDir]")
    .option("--watch", "Enable the file watcher.", { default: true, negatable: true })
    .option("--once", "Run a single plan/apply cycle.", { default: false })
    .option("--plan-only", "Compute the plan without applying it.", { default: false })
    .option("--apply", "Force apply even if the plan is empty.", { default: false })
    .action(async (options, projectDir = ".") => {
      const { json, strict, watch, once, planOnly, apply } = options;
      await handler({
        projectDir,
        watch,
        once,
        planOnly,
        apply,
        global: { json, strict },
      });
    });
}
