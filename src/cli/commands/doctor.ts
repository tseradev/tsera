import { resolve } from "../../shared/path.ts";
import { bold, cyan, dim, gray, green, magenta, yellow } from "../core/colors.ts";
import { Command, type CommandType } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { resolveConfig } from "../core/resolve-config.ts";
import { determineCliVersion } from "../core/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag, type PlanSummary } from "../engine/planner.ts";
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
        const exitCode = context.global.strict ? 2 : 1;
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

class DoctorConsole {
  #spinner: TerminalSpinner;
  #writer: (line: string) => void;
  #projectLabel: string;
  #fixEnabled: boolean;
  #completed = 0;

  constructor(options: { projectDir: string; fix: boolean; writer?: (line: string) => void }) {
    this.#writer = options.writer ?? ((line: string) => console.log(line));
    this.#spinner = new TerminalSpinner(this.#writer);
    this.#projectLabel = formatProjectLabel(options.projectDir);
    this.#fixEnabled = options.fix;
  }

  start(): void {
    const mode = this.#fixEnabled ? `${green("auto-fix activé")}` : `${gray("analyse")}`;
    this.#spinner.start(
      `${magenta("Doctor")} ${dim("•")} ${cyan(this.#projectLabel)} ${dim("│")} ${mode}`,
    );
  }

  planReady(summary: PlanSummary, entities: number): void {
    const checks = summary.total === 1 ? "contrôle" : "contrôles";
    const caption = `${bold(String(summary.total))} ${checks}`;
    this.#spinner.update(
      `${magenta("Doctor")} ${dim("•")} ${caption} ${dim("│")} ${
        gray(`${entities} entité${plural(entities)}`)
      }`,
    );
  }

  allClear(entities: number): void {
    const label = entities === 1 ? "entité vérifiée" : "entités vérifiées";
    this.#spinner.succeed(
      `${green("Tout est parfait")}${dim(" • ")} ${gray(`${entities} ${label}`)}`,
    );
    this.#writer(`${dim("└─")} ${gray("Le projet est cohérent. Aucun correctif nécessaire.")}`);
  }

  reportIssues(summary: PlanSummary): void {
    const actions: string[] = [];
    if (summary.create > 0) {
      actions.push(
        `${green("+" + summary.create)} ${gray(summary.create === 1 ? "création" : "créations")}`,
      );
    }
    if (summary.update > 0) {
      actions.push(
        `${yellow("⇄" + summary.update)} ${
          gray(summary.update === 1 ? "mise à jour" : "mises à jour")
        }`,
      );
    }
    if (summary.delete > 0) {
      actions.push(
        `${magenta("−" + summary.delete)} ${
          gray(summary.delete === 1 ? "suppression" : "suppressions")
        }`,
      );
    }
    const headline = actions.length > 0
      ? actions.join(`${dim("  •  ")}`)
      : gray("Comparaison effectuée");
    this.#spinner.warn(`${yellow("Des correctifs sont requis")}${dim(" • ")} ${headline}`);
  }

  beginFix(total: number): void {
    const label = total === 1 ? "action" : "actions";
    this.#spinner.update(
      `${magenta("Doctor")} ${dim("•")} ${yellow("Auto-réparation en cours")}${dim(" │ ")}${
        gray(`${total} ${label}`)
      }`,
    );
    if (total === 0) {
      this.#writer(`${dim("└─")} ${gray("Analyse des incohérences restantes…")}`);
    }
  }

  trackFixProgress(kind: string, path: string | undefined, total: number): void {
    this.#completed += 1;
    const label = formatActionLabel(kind);
    const progress = total > 0 ? `${this.#completed}/${total}` : `${this.#completed}`;
    const target = path ? cyan(path) : gray("(calcul interne)");
    this.#spinner.update(
      `${yellow("Auto-réparation")}${dim(" • ")} ${progress}${dim(" │ ")}${label}${
        dim(" → ")
      }${target}`,
    );
  }

  completeFix(applied: number): void {
    const label = applied === 1 ? "correctif" : "correctifs";
    this.#spinner.succeed(
      `${green("Synchronisation terminée")}${dim(" • ")} ${gray(`${applied} ${label} appliqués`)}`,
    );
    this.#writer(`${dim("└─")} ${gray("Vous êtes prêt à continuer.")}`);
  }

  reportPending(summary: PlanSummary): void {
    const remaining = summary.create + summary.update + summary.delete;
    const label = remaining === 1 ? "action" : "actions";
    this.#spinner.fail(
      `${yellow("Il reste des incohérences")}${dim(" • ")} ${
        gray(`${remaining} ${label} à traiter`)
      }`,
    );
    this.#writer(`${dim("└─")} ${gray("Relancez la commande pour finaliser la réparation.")}`);
  }

  suggestNextSteps(): void {
    this.#spinner.warn(
      `${yellow("Aucune réparation effectuée")}${dim(" • ")} ${gray("mode lecture seule")}`,
    );
    this.#writer(
      `${dim("└─")} ${gray("Lancez ")}${cyan("tsera doctor --fix")}${
        gray(" pour corriger automatiquement.")
      }`,
    );
    this.#writer(
      `${dim("└─")} ${gray("Ou ")}${cyan("tsera dev --apply")}${
        gray(" pour forcer une régénération complète.")
      }`,
    );
  }
}

class TerminalSpinner {
  #enabled: boolean;
  #timer?: number;
  #frame = 0;
  #text = "";
  #writer: (line: string) => void;
  #staticMessage?: string;

  constructor(writer: (line: string) => void) {
    this.#writer = writer;
    const isInteractive = typeof Deno.stdout.isTerminal === "function" && Deno.stdout.isTerminal();
    const inCi = (typeof Deno.env.get === "function") && Deno.env.get("CI") === "true";
    this.#enabled = isInteractive && !inCi && !Deno.noColor;
  }

  start(text: string): void {
    this.#text = text;
    if (this.#enabled) {
      this.#render(true);
      this.#timer = setInterval(() => this.#render(), 80);
    } else {
      this.#staticMessage = text;
      this.#writer(`${gray("▶")} ${text}`);
    }
  }

  update(text: string): void {
    this.#text = text;
    if (this.#enabled) {
      this.#render(true);
    } else if (this.#staticMessage !== text) {
      this.#staticMessage = text;
      this.#writer(`${gray("↺")} ${text}`);
    }
  }

  succeed(text: string): void {
    this.#finish(`${green("✔")} ${text}`);
  }

  warn(text: string): void {
    this.#finish(`${yellow("⚠")} ${text}`);
  }

  fail(text: string): void {
    this.#finish(`${magenta("✖")} ${text}`);
  }

  #finish(line: string): void {
    if (this.#enabled) {
      this.#clear();
      this.#write(`${line}\n`);
      this.#stop();
    } else {
      this.#writer(line);
    }
    this.#staticMessage = undefined;
  }

  #render(force = false): void {
    if (!this.#enabled) {
      return;
    }
    const frame = SPINNER_FRAMES[this.#frame];
    this.#frame = (this.#frame + 1) % SPINNER_FRAMES.length;
    if (force) {
      this.#clear();
    }
    this.#write(`${frame} ${this.#text}`);
  }

  #clear(): void {
    this.#write(`\r${CLEAR_LINE}`);
  }

  #write(text: string): void {
    const encoder = TerminalSpinner.#encoder;
    Deno.stdout.writeSync(encoder.encode(text));
  }

  #stop(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  static #encoder = new TextEncoder();
}

const SPINNER_FRAMES = [
  gray("⠋"),
  gray("⠙"),
  gray("⠹"),
  gray("⠸"),
  gray("⠼"),
  gray("⠴"),
  gray("⠦"),
  gray("⠧"),
  gray("⠇"),
  gray("⠏"),
];

const CLEAR_LINE = "\x1b[2K";

function formatProjectLabel(projectDir: string): string {
  const segments = projectDir.split(/[/\\]+/).filter((part) => part.length > 0);
  return segments[segments.length - 1] ?? projectDir;
}

function plural(quantity: number): string {
  return quantity > 1 ? "s" : "";
}

function formatActionLabel(kind: string): string {
  switch (kind) {
    case "create":
      return green("création");
    case "update":
      return yellow("mise à jour");
    case "delete":
      return magenta("suppression");
    default:
      return gray(kind);
  }
}
