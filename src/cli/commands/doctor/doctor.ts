import { resolve } from "../../../shared/path.ts";
import { Command } from "cliffy/command";
import { createLogger } from "../../utils/log.ts";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { determineCliVersion } from "../../utils/version.ts";
import { applyPlan } from "../../engine/applier.ts";
import { createDag } from "../../engine/dag.ts";
import { prepareDagInputs } from "../../engine/entities.ts";
import { planDag } from "../../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../../engine/state.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { DoctorConsole } from "./doctor-ui.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";

/** CLI options accepted by the {@code doctor} command. */
interface DoctorCommandOptions extends GlobalCLIOptions {
  cwd: string;
  fix: boolean;
  quick: boolean;
}

/** Options passed to the doctor action handler by Cliffy. */
interface DoctorActionOptions {
  json?: boolean;
  cwd?: string;
  fix?: boolean;
  quick?: boolean;
}

/**
 * Context object passed to doctor command handlers.
 */
export interface DoctorCommandContext {
  /** Current working directory to diagnose. */
  cwd: string;
  /** Whether to automatically apply safe fixes. */
  fix: boolean;
  /** Whether to use quick mode (shows only changes, exits with code 0). */
  quick: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Function signature for doctor command implementations.
 */
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
      quick: context.quick,
      writer,
    });

    if (jsonMode) {
      logger.event("doctor:start", { cwd: projectDir, fix: context.fix, quick: context.quick });
    } else {
      human?.start();
    }

    const { config } = await resolveConfig(projectDir);
    const dagInputs = await prepareDagInputs(projectDir, config);
    const dag = await createDag(dagInputs, { cliVersion });

    await writeDagState(projectDir, dag);

    const previousState = await readEngineState(projectDir);
    // In quick mode, only show changes
    // In full mode, show all artifacts (changed and unchanged)
    const plan = planDag(dag, previousState, { includeUnchanged: !context.quick });

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
        human?.allClear(dagInputs.length, context.quick);
      }
      // In quick mode, exit with code 0
      // In full mode, exit with code 0 if no issues
      const exitCode = 0;
      exitFn(exitCode);
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

    // In quick mode, always exit with code 0
    // In full mode, exit with code 1-2 if issues found
    const exitCode = context.quick ? 0 : (context.global.strict ? 2 : 1);
    exitFn(exitCode);
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera doctor}.
 */
export function createDoctorCommand(
  handler: DoctorCommandHandler = createDefaultDoctorHandler(),
) {
  const command = new Command()
    .description(
      "Diagnose project coherence, detect inconsistencies, and optionally apply safe fixes.",
    )
    .option("--cwd <path:string>", "Project directory to diagnose.", { default: "." })
    .option(
      "--quick",
      "Quick mode: show only changes. Use for validation in CI or before applying.",
      { default: false },
    )
    .option("--fix", "Automatically apply safe corrections to fix detected issues.", {
      default: false,
    })
    .action(async (options: DoctorActionOptions) => {
      const { json = false, cwd = ".", fix = false, quick = false } = options;
      await handler({
        cwd,
        fix,
        quick,
        global: { json },
      });
    });

  // Apply modern help rendering
  const originalShowHelp = command.showHelp.bind(command);
  command.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "doctor",
          description:
            "Diagnose project coherence, detect inconsistencies, and optionally apply safe fixes.",
          options: [
            {
              label: "--cwd <path>",
              description: "Project directory to diagnose (default: current directory)",
            },
            {
              label: "--quick",
              description:
                "Quick mode: show only changes. Use for validation in CI or before applying.",
            },
            {
              label: "--fix",
              description: "Automatically apply safe corrections to fix issues",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera doctor",
            "tsera doctor --quick",
            "tsera doctor --fix",
            "tsera doctor --quick --fix",
            "tsera doctor --cwd ./my-project",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}
