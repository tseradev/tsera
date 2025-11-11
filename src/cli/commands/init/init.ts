import { dirname, join, posixPath, resolve } from "../../../shared/path.ts";
import { normalizeNewlines } from "../../../shared/newline.ts";
import { Command } from "cliffy/command";
import { createLogger } from "../../utils/log.ts";
import { ensureDir, pathExists, safeWrite } from "../../utils/fsx.ts";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { determineCliVersion } from "../../utils/version.ts";
import { applyPlan } from "../../engine/applier.ts";
import { createDag } from "../../engine/dag.ts";
import { prepareDagInputs } from "../../engine/entities.ts";
import { planDag } from "../../engine/planner.ts";
import { readEngineState, writeDagState, writeEngineState } from "../../engine/state.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { InitConsole } from "./init-ui.ts";
import { ensureDirectoryReady, ensureWritable, writeIfMissing } from "./utils/file-ops.ts";
import { composeTemplate, getTemplatesRoot } from "./utils/template-composer.ts";
import { generateConfigFile } from "./utils/config-generator.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";

/** CLI options accepted by the {@code init} command. */
interface InitCommandOptions extends GlobalCLIOptions {
  force: boolean;
  yes: boolean;
  noHono: boolean;
  noFresh: boolean;
  noDocker: boolean;
  noCi: boolean;
  noSecrets: boolean;
}

/** Options passed to the init action handler by Cliffy. */
interface InitActionOptions {
  json?: boolean;
  force?: boolean;
  yes?: boolean;
  /** True if Hono is enabled (default: true unless --no-hono is passed). */
  hono?: boolean;
  /** True if Fresh is enabled (default: true unless --no-fresh is passed). */
  fresh?: boolean;
  /** True if Docker is enabled (default: true unless --no-docker is passed). */
  docker?: boolean;
  /** True if CI is enabled (default: true unless --no-ci is passed). */
  ci?: boolean;
  /** True if Secrets is enabled (default: true unless --no-secrets is passed). */
  secrets?: boolean;
}

/**
 * Context passed to init command handlers.
 */
export interface InitCommandContext {
  /** Target directory for project initialization. */
  directory: string;
  /** Whether to overwrite existing files. */
  force: boolean;
  /** Whether to answer yes to interactive prompts. */
  yes: boolean;
  /** Enabled modules configuration. */
  modules: {
    hono: boolean;
    fresh: boolean;
    docker: boolean;
    ci: boolean;
    secrets: boolean;
  };
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Function signature for init command implementations.
 */
export type InitCommandHandler = (context: InitCommandContext) => Promise<void> | void;

interface InitHandlerDependencies {
  templatesRoot?: string;
  cliVersion?: string;
  writer?: (line: string) => void;
}

/**
 * Resolves the default templates directory from the current module location.
 *
 * @returns Absolute path to the templates directory.
 */
function defaultTemplatesRoot(): string {
  return getTemplatesRoot();
}

/**
 * Checks if the target directory is inside the TSera repository.
 * Used to determine if we should use local sources or JSR imports.
 *
 * @param targetDir - Path to the project being created.
 * @param templatesRoot - Path to templates directory.
 * @returns True if targetDir is inside TSera repo, false otherwise.
 */
function isInsideTSeraRepo(
  targetDir: string,
  templatesRoot: string,
): boolean {
  // templatesRoot is .../templates, go up one level to get repo root
  const repoRoot = dirname(templatesRoot);

  // Normalize both paths for comparison (handle Windows/POSIX differences)
  const normalizedTarget = resolve(targetDir).replace(/\\/g, "/");
  const normalizedRoot = resolve(repoRoot).replace(/\\/g, "/");

  // Check if target is inside repo root
  return normalizedTarget.startsWith(normalizedRoot + "/") ||
    normalizedTarget === normalizedRoot;
}

/**
 * Patches the import_map.json in the target directory based on the environment.
 *
 * - If the project is created inside the TSera repo (dev mode):
 *   Replaces JSR imports with local relative paths to the source code.
 *
 * - If the project is created outside the TSera repo (production):
 *   Leaves JSR imports as-is.
 *
 * This allows seamless development within the repo while ensuring
 * production projects use the published JSR package.
 */
async function patchImportMapForEnvironment(
  targetDir: string,
  templatesRoot: string,
): Promise<void> {
  const importMapPath = join(targetDir, "import_map.json");

  // Check if import_map.json exists
  if (!(await pathExists(importMapPath))) {
    return;
  }

  // Check if we're inside the TSera repository
  const isLocalDev = isInsideTSeraRepo(targetDir, templatesRoot);

  // If not in local dev, leave JSR imports as-is
  if (!isLocalDev) {
    return;
  }

  // Read the existing import_map.json
  const content = await Deno.readTextFile(importMapPath);
  let importMap: { imports?: Record<string, string> };

  try {
    importMap = JSON.parse(content);
  } catch {
    // If parsing fails, skip patching
    return;
  }

  if (!importMap.imports) {
    return;
  }

  // Calculate the path from target directory to the TSera src directory
  // templatesRoot is .../templates, so go up one level to get the repo root, then src/
  const repoRoot = dirname(templatesRoot);
  const srcDir = join(repoRoot, "src");

  // Calculate relative path from target to src (using POSIX paths for Deno imports)
  // Normalize both paths to use forward slashes first
  const normalizedTarget = targetDir.replace(/\\/g, "/");
  const normalizedSrc = srcDir.replace(/\\/g, "/");
  let relativePath = posixPath.relative(normalizedTarget, normalizedSrc);

  // Ensure the path ends with a slash and starts with ./ or ../
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  if (!relativePath.endsWith("/")) {
    relativePath = `${relativePath}/`;
  }

  // Replace JSR imports with local paths for dev mode
  // Only patch imports that start with jsr:@tsera/
  for (const [key, value] of Object.entries(importMap.imports)) {
    if (typeof value === "string" && value.startsWith("jsr:@tsera/")) {
      if (key === "tsera/") {
        importMap.imports[key] = relativePath;
      }
    }
  }

  // Write back with sorted keys for consistency
  const sortedImports = Object.keys(importMap.imports)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = importMap.imports![key];
      return acc;
    }, {});

  const updatedContent = JSON.stringify(
    { ...importMap, imports: sortedImports },
    null,
    2,
  ) + "\n";

  await safeWrite(importMapPath, normalizeNewlines(updatedContent));
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
    const human = jsonMode ? undefined : new InitConsole({ projectDir: targetDir, writer });

    if (jsonMode) {
      logger.event("init:start", {
        directory: targetDir,
        modules: context.modules,
      });
    } else {
      human?.start();
    }

    await ensureDirectoryReady(targetDir, context.force);

    // Determine which modules to enable
    const enabledModules: string[] = [];
    if (context.modules.hono) enabledModules.push("hono");
    if (context.modules.fresh) enabledModules.push("fresh");
    if (context.modules.docker) enabledModules.push("docker");
    if (context.modules.ci) enabledModules.push("ci");
    if (context.modules.secrets) enabledModules.push("secrets");

    // Compose template from base + modules
    const baseDir = join(templatesRoot, "base");
    const modulesDir = join(templatesRoot, "modules");

    // Default database configuration for env file generation
    const defaultDbConfig = {
      dialect: "postgres" as const,
      urlEnv: "DATABASE_URL",
      ssl: "prefer" as const,
    };

    const composition = await composeTemplate({
      targetDir,
      baseDir,
      modulesDir,
      enabledModules,
      force: context.force,
      dbConfig: defaultDbConfig,
    });

    // Patch import_map.json based on environment (local dev vs production)
    await patchImportMapForEnvironment(targetDir, templatesRoot);

    if (jsonMode) {
      logger.event("init:copy", {
        files: composition.copiedFiles.length,
        merged: composition.mergedFiles.length,
        skipped: composition.skippedFiles.length,
        modules: enabledModules,
      });
    } else {
      human?.templateReady(
        composition.copiedFiles.length + composition.mergedFiles.length,
        composition.skippedFiles.length,
      );
    }

    const projectName = deriveProjectName(targetDir);
    const configDir = join(targetDir, "config");
    await ensureDir(configDir);
    const configPath = join(configDir, "tsera.config.ts");
    await ensureWritable(configPath, context.force, "config/tsera.config.ts");
    await safeWrite(configPath, generateConfigFile(projectName, context.modules));
    if (jsonMode) {
      logger.event("init:config", { path: configPath, modules: context.modules });
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
) {
  const command = new Command()
    .description("Initialize a new TSera project.")
    .arguments("[directory]")
    .option("-f, --force", "Overwrite existing files.", { default: false })
    .option("-y, --yes", "Answer yes to interactive prompts.", { default: false })
    .option("--no-hono", "Disable Hono API module.")
    .option("--no-fresh", "Disable Fresh frontend module.")
    .option("--no-docker", "Disable Docker Compose module.")
    .option("--no-ci", "Disable CI/CD workflows.")
    .option("--no-secrets", "Disable type-safe secrets management.")
    .action(async (options: InitActionOptions, directory = ".") => {
      const {
        json = false,
        force = false,
        yes = false,
        hono = true,
        fresh = true,
        docker = true,
        ci = true,
        secrets = true,
      } = options;
      await handler({
        directory,
        force,
        yes,
        modules: {
          hono,
          fresh,
          docker,
          ci,
          secrets,
        },
        global: { json },
      });
    });

  // Apply modern help rendering
  const originalShowHelp = command.showHelp.bind(command);
  command.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "init",
          description: "Scaffold a TSera project from base template and selected modules.",
          usage: "[directory]",
          options: [
            {
              label: "[directory]",
              description: "Target directory for the new project (default: current directory)",
            },
            {
              label: "-f, --force",
              description: "Overwrite existing files",
            },
            {
              label: "-y, --yes",
              description: "Answer yes to all prompts (non-interactive mode)",
            },
            {
              label: "--no-hono",
              description: "Disable Hono API module (enabled by default)",
            },
            {
              label: "--no-fresh",
              description: "Disable Fresh frontend module (enabled by default)",
            },
            {
              label: "--no-docker",
              description: "Disable Docker Compose module (enabled by default)",
            },
            {
              label: "--no-ci",
              description: "Disable CI/CD workflows (enabled by default)",
            },
            {
              label: "--no-secrets",
              description: "Disable type-safe secrets management (enabled by default)",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera init",
            "tsera init my-app",
            "tsera init my-app --no-fresh --no-docker",
            "tsera init --no-hono --no-ci",
            "tsera init --force --yes",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}

/**
 * Generates a default .gitignore file content for TSera projects.
 *
 * @returns .gitignore content with common TSera-specific ignores.
 */
function buildGitignore(): string {
  const content = [
    "# TSera",
    ".tsera/graph.json",
    ".tsera/manifest.json",
    "drizzle/",
    "dist/",
    "node_modules/",
    ".env",
    ".env.*",
    "",
    "# TSera secrets (local unless using git-crypt)",
    "secrets/.env.dev",
    "secrets/.env.preprod",
    "secrets/.env.prod",
    "!secrets/.env.example",
    "",
    "# KV store and salt (local unless using git-crypt)",
    ".tsera/kv/",
    ".tsera/salt",
    "",
    "coverage/",
    "*.log",
  ].join("\n") + "\n";
  return normalizeNewlines(content);
}

/**
 * Derives a PascalCase project name from a directory path.
 *
 * @param path - Directory path to derive name from.
 * @returns PascalCase project name, or "TSeraApp" if path is empty or "."
 */
function deriveProjectName(path: string): string {
  const base = basename(path);
  if (!base || base === ".") {
    return "TSeraApp";
  }
  return toPascalCase(base);
}

/**
 * Extracts the last segment of a path (basename).
 *
 * @param path - Path to extract basename from.
 * @returns Last segment of the path.
 */
function basename(path: string): string {
  const normalised = path.replace(/\\+/g, "/").replace(/\/+$/, "");
  if (normalised === "") {
    return normalised;
  }
  const parts = normalised.split("/");
  return parts[parts.length - 1] || normalised;
}

/**
 * Converts a string to PascalCase by splitting on non-alphanumeric characters.
 *
 * @param value - String to convert.
 * @returns PascalCase representation of the input.
 */
function toPascalCase(value: string): string {
  const parts = value
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase());
  return parts.length > 0 ? parts.join("") : value;
}
