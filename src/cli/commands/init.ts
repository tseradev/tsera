import { dirname, join, resolve } from "../../shared/path.ts";
import { normalizeNewlines } from "../../shared/newline.ts";
import { Command } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { safeWrite } from "../core/fsx.ts";
import { resolveConfig } from "../core/resolve-config.ts";
import { determineCliVersion } from "../core/version.ts";
import { applyPlan } from "../engine/applier.ts";
import { createDag } from "../engine/dag.ts";
import { prepareDagInputs } from "../engine/entities.ts";
import { planDag } from "../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../engine/state.ts";
import type { GlobalCLIOptions } from "../router.ts";

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
    const logger = createLogger({ json: context.global.json, writer });
    const targetDir = resolve(context.directory);
    const templateDir = join(templatesRoot, context.template);

    logger.event("init:start", { directory: targetDir, template: context.template });

    await ensureDirectoryReady(targetDir, context.force);

    if (!(await pathExists(templateDir))) {
      throw new Error(`Unknown template: ${context.template}`);
    }

    const copy = await copyTemplateDirectory(templateDir, targetDir, { force: context.force });
    logger.event("init:copy", { files: copy.files.length, skipped: copy.skipped.length });

    const projectName = deriveProjectName(targetDir);
    const configPath = join(targetDir, "tsera.config.ts");
    await ensureWritable(configPath, context.force, "tsera.config.ts");
    await safeWrite(configPath, generateConfigFile(projectName));
    logger.event("init:config", { path: configPath });

    const gitignorePath = join(targetDir, ".gitignore");
    await writeIfMissing(gitignorePath, buildGitignore(), context.force);

    const { config } = await resolveConfig(targetDir);
    const dagInputs = await prepareDagInputs(targetDir, config);
    const dag = await createDag(dagInputs, { cliVersion });

    await writeDagState(targetDir, dag);

    const previousState = await readEngineState(targetDir);
    const plan = planDag(dag, previousState, { includeUnchanged: true });
    logger.event("init:plan", { summary: plan.summary });

    let nextState = previousState;
    if (plan.summary.changed) {
      nextState = await applyPlan(plan, previousState, {
        projectDir: targetDir,
        onStep: (step, result) => {
          logger.event("init:apply:step", {
            id: step.node.id,
            kind: step.kind,
            path: result.path ?? null,
            changed: result.changed,
          });
        },
      });
      logger.event("init:apply", {
        create: plan.summary.create,
        update: plan.summary.update,
        delete: plan.summary.delete,
      });
    }

    await writeEngineState(targetDir, nextState);

    if (!context.global.json) {
      logger.info("Project initialized", { directory: targetDir });
      logger.info("Tip", {
        next: 'git init && git add -A && git commit -m "feat: boot tsera"',
      });
    }

    logger.event("init:done", {
      directory: targetDir,
      entities: dagInputs.length,
      changed: plan.summary.changed,
    });
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera init}.
 */
export function createInitCommand(
  handler: InitCommandHandler = createDefaultInitHandler(),
): Command<InitCommandOptions> {
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

function deriveSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tsera";
}

function generateConfigFile(projectName: string): string {
  const slug = deriveSlug(projectName);
  const dbName = slug.replace(/-/g, "_");

  const template = `// TSera configuration (full profile with comments).
import type { TseraConfig } from "tsera/cli/contracts/types.ts";

const config: TseraConfig = {
  // Human-friendly project name (used in artifacts and documentation).
  projectName: "${projectName}",
  // Project root directory. Keep "." except for advanced setups.
  rootDir: ".",
  // Folder containing TSera entities (files *.entity.ts).
  entitiesDir: "domain",
  // Folder for generated artifacts (schemas, docs, openapi, tests...).
  artifactsDir: ".tsera",
  // Optional: explicit list of entities to load instead of the recursive scan.
  // entities: ["domain/User.entity.ts"],
  db: {
    // Target dialect for Drizzle migrations (postgres | sqlite).
    dialect: "postgres",
    // Connection string used by tests and the local runtime.
    connectionString: "postgres://localhost/${dbName}",
    // Folder storing generated migrations.
    migrationsDir: "drizzle",
    // Folder for Drizzle schemas (generated automatically).
    schemaDir: "drizzle/schema",
  },
  deploy: [
    {
      // Main deployment target (e.g. Deno Deploy).
      name: "production",
      kind: "deno-deploy",
      envFile: ".env.deploy",
    },
    {
      // Example of a custom target driven by a shell script.
      name: "on-premise",
      kind: "custom-script",
      script: "scripts/deploy.sh",
      envFile: ".env.production",
    },
  ],
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
