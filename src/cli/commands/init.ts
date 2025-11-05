import { join, resolve } from "../../shared/path.ts";
import { normalizeNewlines } from "../../shared/newline.ts";
import { fromFileUrl } from "../../shared/file-url.ts";
import { Command, type CommandType } from "../deps/command.ts";
import { createLogger } from "../lib/log.ts";
import { pathExists, safeWrite } from "../lib/fsx.ts";
import { resolveConfig } from "../lib/resolve-config.ts";
import { determineCliVersion } from "../lib/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import type { GlobalCLIOptions } from "../router.ts";
import { InitConsole } from "./init-ui.ts";
import { ensureDirectoryReady, ensureWritable, writeIfMissing } from "./utils/file-ops.ts";
import { copyTemplateDirectory } from "./utils/template-copy.ts";
import { generateConfigFile } from "./utils/config-generator.ts";

/** CLI options accepted by the {@code init} command. */
interface InitCommandOptions extends GlobalCLIOptions {
  template: string;
  force: boolean;
  yes: boolean;
}

/** Context passed to init command handlers. */
export interface InitCommandContext {
  directory: string;
  template: string;
  force: boolean;
  yes: boolean;
  global: GlobalCLIOptions;
}

/** Function signature for init command implementations. */
export type InitCommandHandler = (context: InitCommandContext) => Promise<void> | void;

interface InitHandlerDependencies {
  templatesRoot?: string;
  cliVersion?: string;
  writer?: (line: string) => void;
}

/** Resolves the default templates directory from the current module location. */
function defaultTemplatesRoot(): string {
  return fromFileUrl(new URL("../../../templates", import.meta.url));
}

/**
 * Creates the default {@code init} command handler responsible for scaffolding projects.
 */
export function createDefaultInitHandler(
  dependencies: InitHandlerDependencies = {},
): InitCommandHandler {
  const templatesRoot = dependencies.templatesRoot ?? defaultTemplatesRoot();
  const cliVersion = dependencies.cliVersion ?? determineCliVersion();
  const writer = dependencies.writer;

  return async (context) => {
    const jsonMode = context.global.json;
    const logger = createLogger({ json: jsonMode, writer });
    const targetDir = resolve(context.directory);
    const templateDir = join(templatesRoot, context.template);
    const human = jsonMode
      ? undefined
      : new InitConsole({ projectDir: targetDir, template: context.template, writer });

    if (jsonMode) {
      logger.event("init:start", { directory: targetDir, template: context.template });
    } else {
      human?.start();
    }

    await ensureDirectoryReady(targetDir, context.force);

    if (!(await pathExists(templateDir))) {
      throw new Error(`Unknown template: ${context.template}`);
    }

    const copy = await copyTemplateDirectory(templateDir, targetDir, { force: context.force });
    if (jsonMode) {
      logger.event("init:copy", { files: copy.files.length, skipped: copy.skipped.length });
    } else {
      human?.templateReady(copy.files.length, copy.skipped.length);
    }

    const projectName = deriveProjectName(targetDir);
    const configPath = join(targetDir, "tsera.config.ts");
    await ensureWritable(configPath, context.force, "tsera.config.ts");
    await safeWrite(configPath, generateConfigFile(projectName));
    if (jsonMode) {
      logger.event("init:config", { path: configPath });
    } else {
      human?.configReady(configPath);
    }

    const gitignorePath = join(targetDir, ".gitignore");
    const gitignoreExisted = await pathExists(gitignorePath);
    await writeIfMissing(gitignorePath, buildGitignore(), context.force);
    if (!jsonMode) {
      human?.gitignoreReady(gitignorePath, context.force || !gitignoreExisted);
    }

    const { config } = await resolveConfig(targetDir);
    const dagInputs = await prepareDagInputs(targetDir, config);
    const dag = await createDag(dagInputs, { cliVersion });

    await writeDagState(targetDir, dag);

    const previousState = await readEngineState(targetDir);
    const plan = planDag(dag, previousState, { includeUnchanged: true });
    if (jsonMode) {
      logger.event("init:plan", { summary: plan.summary });
    } else {
      human?.planReady(plan.summary, dagInputs.length);
    }

    let nextState = previousState;
    if (plan.summary.changed) {
      if (!jsonMode) {
        human?.applyStart(plan.summary);
      }
      nextState = await applyPlan(plan, previousState, {
        projectDir: targetDir,
        onStep: (step, result) => {
          if (jsonMode) {
            logger.event("init:apply:step", {
              id: step.node.id,
              kind: step.kind,
              path: result.path ?? null,
              changed: result.changed,
            });
          } else {
            human?.trackStep(step.kind, result.path, result.changed);
          }
        },
      });
      if (jsonMode) {
        logger.event("init:apply", {
          create: plan.summary.create,
          update: plan.summary.update,
          delete: plan.summary.delete,
        });
      } else {
        human?.applyComplete(plan.summary);
      }
    }
    if (!plan.summary.changed && !jsonMode) {
      human?.alreadySynced();
    }

    await writeEngineState(targetDir, nextState);

    if (jsonMode) {
      logger.info("Project initialized", { directory: targetDir });
      logger.info("Tip", {
        next: 'git init && git add -A && git commit -m "feat: boot tsera"',
      });
    } else {
      human?.complete();
    }

    if (jsonMode) {
      logger.event("init:done", {
        directory: targetDir,
        entities: dagInputs.length,
        changed: plan.summary.changed,
      });
    }
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera init}.
 */
export function createInitCommand(
  handler: InitCommandHandler = createDefaultInitHandler(),
): CommandType<InitCommandOptions> {
  return new Command<InitCommandOptions>()
    .description("Initialize a new TSera project.")
    .arguments("[directory]")
    .option("--template <name:string>", "Template to use.", { default: "app-minimal" })
    .option("-f, --force", "Overwrite existing files.", { default: false })
    .option("-y, --yes", "Answer yes to interactive prompts.", { default: false })
    .action(async (options, directory = ".") => {
      const { json, template, force, yes } = options;
      await handler({
        directory,
        template,
        force,
        yes,
        global: { json },
      });
    });
}

function buildGitignore(): string {
  const content = [
    "# TSera",
    ".tsera/",
    "drizzle/",
    "dist/",
    "node_modules/",
    ".env",
    ".env.*",
    "coverage/",
    "*.log",
  ].join("\n") + "\n";
  return normalizeNewlines(content);
}

function deriveProjectName(path: string): string {
  const base = basename(path);
  if (!base || base === ".") {
    return "TSeraApp";
  }
  return toPascalCase(base);
}

function basename(path: string): string {
  const normalised = path.replace(/\\+/g, "/").replace(/\/+$/, "");
  if (normalised === "") {
    return normalised;
  }
  const parts = normalised.split("/");
  return parts[parts.length - 1] || normalised;
}

function toPascalCase(value: string): string {
  const parts = value
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase());
  return parts.length > 0 ? parts.join("") : value;
}
