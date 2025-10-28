import { resolve } from "../../shared/path.ts";
import { Command, type CommandType } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { resolveConfig } from "../core/resolve-config.ts";
import { determineCliVersion } from "../core/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import type { GlobalCLIOptions } from "../router.ts";

/** CLI options accepted by the {@code doctor} command. */
interface DoctorCommandOptions extends GlobalCLIOptions {
  cwd: string;
  fix: boolean;
}

/** Context object passed to doctor command handlers. */
export interface DoctorCommandContext {
  cwd: string;
  fix: boolean;
  global: GlobalCLIOptions;
}

/** Function signature for doctor command implementations. */
export type DoctorCommandHandler = (context: DoctorCommandContext) => Promise<void> | void;

interface DoctorHandlerDependencies {
  cliVersion?: string;
  writer?: (line: string) => void;
  exit?: (code: number) => never;
}

/**
 * Creates the default doctor command handler which diagnoses and optionally fixes artifacts.
 */
export function createDefaultDoctorHandler(
  dependencies: DoctorHandlerDependencies = {},
): DoctorCommandHandler {
  const cliVersion = dependencies.cliVersion ?? determineCliVersion();
  const writer = dependencies.writer;
  const exitFn = dependencies.exit ?? ((code: number): never => Deno.exit(code));

  return async (context) => {
    const logger = createLogger({ json: context.global.json, writer });
    const projectDir = resolve(context.cwd);

    logger.event("doctor:start", { cwd: projectDir, fix: context.fix });

    const { config } = await resolveConfig(projectDir);
    const dagInputs = await prepareDagInputs(projectDir, config);
    const dag = await createDag(dagInputs, { cliVersion });

    await writeDagState(projectDir, dag);

    const previousState = await readEngineState(projectDir);
    const plan = planDag(dag, previousState, { includeUnchanged: true });

    logger.event("doctor:plan", { summary: plan.summary });

    if (!plan.summary.changed) {
      logger.event("doctor:clean", { entities: dagInputs.length });
      if (!context.global.json) {
        logger.info("No inconsistencies detected", { entities: dagInputs.length });
      }
      return;
    }

    logger.event("doctor:issues", {
      create: plan.summary.create,
      update: plan.summary.update,
      delete: plan.summary.delete,
      total: plan.summary.total,
    });

    if (!context.global.json) {
      logger.warn("Artifacts need to be regenerated", {
        create: plan.summary.create,
        update: plan.summary.update,
        delete: plan.summary.delete,
      });
    }

    if (context.fix) {
      const nextState = await applyPlan(plan, previousState, {
        projectDir,
        onStep: (step, result) => {
          logger.event("doctor:apply:step", {
            id: step.node.id,
            kind: step.kind,
            path: result.path ?? null,
            changed: result.changed,
          });
        },
      });

      await writeEngineState(projectDir, nextState);

      const followUp = planDag(dag, nextState);
      if (followUp.summary.changed) {
        logger.event("doctor:pending", { summary: followUp.summary });
        if (!context.global.json) {
          logger.warn("Some inconsistencies remain", { summary: followUp.summary });
        }
        const exitCode = context.global.strict ? 2 : 1;
        exitFn(exitCode);
      }

      logger.event("doctor:fixed", { steps: plan.summary.total });
      if (!context.global.json) {
        logger.info("Inconsistencies fixed", { steps: plan.summary.total });
      }
      return;
    }

    if (!context.global.json) {
      logger.info("Run", { next: "tsera doctor --fix" });
      logger.info("Or", { next: "tsera dev --apply" });
    }

    const exitCode = context.global.strict ? 2 : 1;
    exitFn(exitCode);
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera doctor}.
 */
export function createDoctorCommand(
  handler: DoctorCommandHandler = createDefaultDoctorHandler(),
): CommandType<DoctorCommandOptions> {
  return new Command<DoctorCommandOptions>()
    .description("Check project coherence and suggest safe fixes.")
    .option("--cwd <path:string>", "Project directory to diagnose.", { default: "." })
    .option("--fix", "Automatically apply safe corrections.", { default: false })
    .action(async (options) => {
      const { json, strict, cwd, fix } = options;
      await handler({
        cwd,
        fix,
        global: { json, strict },
      });
    });
}
