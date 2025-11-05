import { dirname, join, resolve } from "../../shared/path.ts";
import { normalizeNewlines } from "../../shared/newline.ts";
import { Command, type CommandType } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { safeWrite } from "../core/fsx.ts";
import { resolveConfig } from "../core/resolve-config.ts";
import { determineCliVersion } from "../core/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag, type PlanStepKind, type PlanSummary } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import type { GlobalCLIOptions } from "../router.ts";
import { bold, cyan, dim, gray, green, magenta, yellow } from "../core/colors.ts";

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

interface CopyResult {
  files: string[];
  skipped: string[];
}

/** Resolves the default templates directory from the current module location. */
function defaultTemplatesRoot(): string {
  return fromFileUrlSafe(new URL("../../../templates", import.meta.url));
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
      const { json, strict, template, force, yes } = options;
      await handler({
        directory,
        template,
        force,
        yes,
        global: { json, strict },
      });
    });
}

async function ensureDirectoryReady(path: string, force: boolean): Promise<void> {
  if (await pathExists(path)) {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`The path ${path} already exists and is not a directory.`);
    }
    if (!force && await directoryHasEntries(path)) {
      throw new Error(`The directory ${path} is not empty. Use --force to continue.`);
    }
    return;
  }

  await Deno.mkdir(path, { recursive: true });
}

async function directoryHasEntries(path: string): Promise<boolean> {
  for await (const _ of Deno.readDir(path)) {
    return true;
  }
  return false;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function copyTemplateDirectory(
  source: string,
  destination: string,
  options: { force: boolean },
): Promise<CopyResult> {
  const files: string[] = [];
  const skipped: string[] = [];

  await walk(source, async (relativePath, absoluteSource, entry) => {
    const targetPath = join(destination, relativePath);

    if (entry.isDirectory) {
      await ensureDir(targetPath);
      return;
    }

    if (!entry.isFile) {
      return;
    }

    if (!options.force && await pathExists(targetPath)) {
      skipped.push(relativePath);
      return;
    }

    const content = await Deno.readFile(absoluteSource);
    await ensureDir(dirname(targetPath));
    await safeWrite(targetPath, content);
    files.push(relativePath);
  });

  return { files, skipped };
}

async function walk(
  root: string,
  visitor: (relativePath: string, absolutePath: string, entry: Deno.DirEntry) => Promise<void>,
  current = "",
): Promise<void> {
  for await (const entry of Deno.readDir(join(root, current))) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    const absolute = join(root, relative);
    await visitor(relative, absolute, entry);
    if (entry.isDirectory) {
      await walk(root, visitor, relative);
    }
  }
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return;
    }
    throw error;
  }
}

async function ensureWritable(path: string, force: boolean, label: string): Promise<void> {
  if (!await pathExists(path)) {
    return;
  }
  if (force) {
    return;
  }
  throw new Error(`${label} already exists. Use --force to regenerate it.`);
}

async function writeIfMissing(path: string, content: string, force: boolean): Promise<void> {
  if (await pathExists(path) && !force) {
    return;
  }
  await safeWrite(path, normalizeNewlines(content));
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

function generateConfigFile(_projectName: string): string {
  const envVar = "TSERA_DATABASE_URL";
  const sqliteFile = "data/tsera.sqlite";

  const template = `// TSera configuration (full profile with comments).
import type { TseraConfig } from "tsera/cli/contracts/types.ts";

const config: TseraConfig = {
  // Toggle generated artifacts controlled by "tsera dev".
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  // Folder storing generated schemas, manifests, and OpenAPI files.
  outDir: ".tsera",
  // Source folders scanned for entities (add files or globs as needed).
  paths: {
    entities: ["domain"],
    // routes: ["routes/**/*.ts"],
  },
  db: {
    // Choose between "postgres", "mysql", or "sqlite".
    dialect: "postgres",
    // Environment variable supplying the connection URL.
    urlEnv: "${envVar}",
    ssl: "prefer",
    // Example SQLite configuration:
    // dialect: "sqlite",
    // file: "${sqliteFile}",
  },
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "main.ts",
    envFile: ".env.deploy",
  },
};

export default config;
`;

  return normalizeNewlines(template);
}

function fromFileUrlSafe(url: URL): string {
  if (url.protocol !== "file:") {
    throw new TypeError(`Expected a file URL, received ${url.protocol}`);
  }

  let path = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows") {
    if (path.startsWith("/")) {
      path = path.slice(1);
    }
    return path.replaceAll("/", "\\");
  }
  return path;
}

/**
 * Human-friendly progress reporter for {@code tsera init} when JSON output is disabled.
 */
class InitConsole {
  #writer: (line: string) => void;
  #projectDir: string;
  #projectLabel: string;
  #template: string;
  #hadChanges = false;
  #normalizedDir: string;

  constructor(options: { projectDir: string; template: string; writer?: (line: string) => void }) {
    this.#writer = options.writer ?? ((line: string) => console.log(line));
    this.#projectDir = sanitizeProjectDir(options.projectDir);
    this.#normalizedDir = this.#projectDir.replace(/\\/g, "/");
    this.#projectLabel = formatProjectLabel(this.#projectDir);
    this.#template = options.template;
  }

  /** Announces the beginning of the scaffolding process. */
  start(): void {
    this.#writer(
      `${magenta("Init")} ${dim("•")} ${cyan(this.#projectLabel)} ${dim("│ using template ")}${
        gray(this.#template)
      }`,
    );
    this.#writer(`${dim("└─")} ${gray("Preparing project folder…")}`);
  }

  /** Reports how many template files were copied or reused. */
  templateReady(copied: number, skipped: number): void {
    const copiedLabel = copied === 1 ? "file copied" : "files copied";
    const skippedLabel = skipped > 0
      ? `${dim(" • ")}${gray(`${skipped} ${skipped === 1 ? "file skipped" : "files skipped"}`)}`
      : "";
    this.#writer(
      `${dim("├─")} ${green(`${copied} ${copiedLabel}`)}${skippedLabel}`,
    );
  }

  /** Highlights that the configuration file is ready to edit. */
  configReady(path: string): void {
    this.#writer(
      `${dim("├─")} ${green("Configuration ready")}${dim(" • ")}${gray(this.#relative(path))}`,
    );
  }

  /** States whether a .gitignore file was written. */
  gitignoreReady(path: string, created: boolean): void {
    if (created) {
      this.#writer(
        `${dim("├─")} ${green("Added .gitignore")}${dim(" • ")}${gray(this.#relative(path))}`,
      );
    } else {
      this.#writer(`${dim("├─")} ${gray("Existing .gitignore kept as-is")}`);
    }
  }

  /** Summarises the discovered entities and plan outcome. */
  planReady(summary: PlanSummary, entities: number): void {
    const entityLabel = entities === 1 ? "entity" : "entities";
    const base = `${entities} ${entityLabel} detected`;
    if (summary.changed) {
      this.#writer(
        `${dim("├─")} ${yellow("Generating project assets")}${dim(" • ")}${gray(base)}`,
      );
    } else {
      this.#writer(`${dim("├─")} ${green("Artifacts already in sync")}${dim(" • ")}${gray(base)}`);
    }
  }

  /** Announces that artifact generation is about to begin. */
  applyStart(summary: PlanSummary): void {
    this.#hadChanges = true;
    const actions = formatActionSummary(summary);
    this.#writer(`${dim("├─")} ${yellow("Writing generated files")}${dim(" • ")}${gray(actions)}`);
  }

  /** Tracks individual artifact operations while generating outputs. */
  trackStep(kind: PlanStepKind, path: string | undefined, changed: boolean): void {
    if (!changed && kind !== "delete") {
      return;
    }
    const label = formatStepLabel(kind);
    const location = path ? cyan(this.#relative(join(this.#projectDir, path))) : gray("internal");
    this.#writer(`${dim("│  ")} ${label}${dim(" → ")}${location}`);
  }

  /** Confirms that all requested artifacts were written. */
  applyComplete(summary: PlanSummary): void {
    const actions = formatActionSummary(summary);
    this.#writer(`${dim("├─")} ${green("Artifacts updated")}${dim(" • ")}${gray(actions)}`);
  }

  /** Shares that no artifacts required regeneration. */
  alreadySynced(): void {
    this.#writer(`${dim("├─")} ${gray("Everything was already up to date")}`);
  }

  /** Provides closing guidance on the next recommended steps. */
  complete(): void {
    this.#writer(`${green("✔")} ${bold("Project ready!")}`);
    const recap = this.#hadChanges
      ? gray("Generated project assets for you.")
      : gray("Project files were already current.");
    this.#writer(`${dim("├─")} ${recap}`);
    this.#writer(`${dim("└─")} ${gray("Next steps:")}`);
    this.#writer(`${dim("   • ")}${cyan(`cd ${this.#projectDir}`)}`);
    this.#writer(
      `${dim("   • ")}${cyan('git init && git add -A && git commit -m "feat: boot tsera"')}`,
    );
    this.#writer(`${dim("   • ")}${cyan("tsera dev --watch")}`);
  }

  /** Formats an absolute path so it is shown relative to the project directory when possible. */
  #relative(path: string): string {
    const normalised = path.replace(/\\/g, "/");
    if (normalised.startsWith(this.#normalizedDir)) {
      const suffix = normalised.slice(this.#normalizedDir.length).replace(/^\//, "");
      return suffix.length > 0 ? suffix : ".";
    }
    return path;
  }
}

/** Normalises trailing separators from the provided project directory. */
function sanitizeProjectDir(projectDir: string): string {
  return projectDir.replace(/[\\/]+$/, "");
}

/** Derives a concise label from an absolute project directory path. */
function formatProjectLabel(projectDir: string): string {
  const segments = projectDir.split(/[/\\]+/).filter((part) => part.length > 0);
  return segments[segments.length - 1] ?? projectDir;
}

/** Converts plan summary counts into a short human readable phrase. */
function formatActionSummary(summary: PlanSummary): string {
  const parts: string[] = [];
  if (summary.create > 0) {
    parts.push(`${summary.create} ${summary.create === 1 ? "creation" : "creations"}`);
  }
  if (summary.update > 0) {
    parts.push(`${summary.update} ${summary.update === 1 ? "update" : "updates"}`);
  }
  if (summary.delete > 0) {
    parts.push(`${summary.delete} ${summary.delete === 1 ? "deletion" : "deletions"}`);
  }
  return parts.length > 0 ? parts.join(" • ") : "no changes";
}

/** Chooses a color-coded label for the given plan step kind. */
function formatStepLabel(kind: PlanStepKind): string {
  switch (kind) {
    case "create":
      return green("create");
    case "update":
      return yellow("update");
    case "delete":
      return magenta("delete");
    default:
      return gray(kind);
  }
}
