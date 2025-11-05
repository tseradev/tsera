import { resolve } from "../../shared/path.ts";
import { Command } from "../deps/command.ts";
import { createLogger } from "../lib/log.ts";
import { resolveConfig } from "../lib/resolve-config.ts";
import { determineCliVersion } from "../lib/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import type { GlobalCLIOptions } from "../router.ts";
import { DoctorConsole } from "./doctor-ui.ts";

/** CLI options accepted by the {@code doctor} command. */
interface DoctorCommandOptions extends GlobalCLIOptions {
  cwd: string;
  fix: boolean;
}

/** Options passed to the doctor action handler by Cliffy. */
interface DoctorActionOptions {
  json?: boolean;
  cwd?: string;
  fix?: boolean;
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
    const jsonMode = context.global.json;
    const logger = createLogger({ json: jsonMode, writer });
    const projectDir = resolve(context.cwd);
    const human = jsonMode ? undefined : new DoctorConsole({
      projectDir,
      fix: context.fix,
      writer,
    });

    if (jsonMode) {
      logger.event("doctor:start", { cwd: projectDir, fix: context.fix });
    } else {
      human?.start();
    }

    const { config } = await resolveConfig(projectDir);
    const dagInputs = await prepareDagInputs(projectDir, config);
    const dag = await createDag(dagInputs, { cliVersion });

    await writeDagState(projectDir, dag);

    const previousState = await readEngineState(projectDir);
    const plan = planDag(dag, previousState, { includeUnchanged: true });

    if (jsonMode) {
      logger.event("doctor:plan", { summary: plan.summary });
    } else {
      human?.planReady(plan.summary, dagInputs.length);
    }

    if (!plan.summary.changed) {
      if (jsonMode) {
        logger.event("doctor:clean", { entities: dagInputs.length });
        logger.info("No inconsistencies detected", { entities: dagInputs.length });
      } else {
        human?.allClear(dagInputs.length);
      }
      return;
    }

    if (jsonMode) {
      logger.event("doctor:issues", {
        create: plan.summary.create,
        update: plan.summary.update,
        delete: plan.summary.delete,
        total: plan.summary.total,
      });
      logger.warn("Artifacts need to be regenerated", {
        create: plan.summary.create,
        update: plan.summary.update,
        delete: plan.summary.delete,
      });
    } else {
      human?.reportIssues(plan.summary);
    }

    if (context.fix) {
      const actionableSteps = plan.steps.filter((step) => step.kind !== "noop");
      if (!jsonMode) {
        human?.beginFix(actionableSteps.length);
      }
      const nextState = await applyPlan(plan, previousState, {
        projectDir,
        onStep: (step, result) => {
          if (jsonMode) {
            logger.event("doctor:apply:step", {
              id: step.node.id,
              kind: step.kind,
              path: result.path ?? null,
              changed: result.changed,
            });
          } else if (step.kind !== "noop") {
            human?.trackFixProgress(step.kind, result.path, actionableSteps.length);
          }
        },
      });

      await writeEngineState(projectDir, nextState);

      const followUp = planDag(dag, nextState);
      if (followUp.summary.changed) {
        if (jsonMode) {
          logger.event("doctor:pending", { summary: followUp.summary });
          logger.warn("Some inconsistencies remain", { summary: followUp.summary });
        } else {
          human?.reportPending(followUp.summary);
        }
        const exitCode = 1;
        exitFn(exitCode);
      }

      if (jsonMode) {
        logger.event("doctor:fixed", { steps: plan.summary.total });
        logger.info("Inconsistencies fixed", { steps: plan.summary.total });
      } else {
        human?.completeFix(actionableSteps.length);
      }
      return;
    }

    if (jsonMode) {
      logger.info("Run", { next: "tsera doctor --fix" });
      logger.info("Or", { next: "tsera dev --apply" });
    } else {
      human?.suggestNextSteps();
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
) {
  return new Command()
    .description("Check project coherence and suggest safe fixes.")
    .option("--cwd <path:string>", "Project directory to diagnose.", { default: "." })
    .option("--fix", "Automatically apply safe corrections.", { default: false })
    .action(async (options: DoctorActionOptions) => {
      const { json = false, cwd = ".", fix = false } = options;
      await handler({
        cwd,
        fix,
        global: { json },
      });
    });
}
