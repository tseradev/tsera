/**
 * Template composition system for TSera projects.
 *
 * This module handles the composition of modular templates, allowing users
 * to enable or disable specific features (Hono, Fresh, Docker, CI, Secrets)
 * through command-line flags.
 *
 * @module
 */

import { dirname, join, relative } from "../../../../shared/path.ts";
import { fromFileUrl } from "../../../../shared/file-url.ts";
import { exists } from "std/fs";
import { walk } from "std/fs/walk";
import { ensureDir } from "../../../utils/fsx.ts";
import type { DbConfig } from "../../../definitions.ts";
import { generateEnvFiles } from "./env-generator.ts";

/**
 * Strategy for handling file conflicts during composition.
 */
export type MergeStrategy = "copy" | "merge" | "skip";

/**
 * Definition of a template module.
 */
export interface TemplateModule {
  /** Module name (e.g., "hono", "fresh"). */
  name: string;
  /** Strategy for handling file conflicts. */
  mergeStrategy: MergeStrategy;
  /** Module dependencies (must be enabled if this module is enabled). */
  dependencies?: string[];
  /** Custom merge handler for specific file types. */
  customMerge?: (target: string, source: string) => Promise<string>;
}

/**
 * Options for template composition.
 */
export interface ComposeOptions {
  /** Target directory where the project will be created. */
  targetDir: string;
  /** Base template directory. */
  baseDir: string;
  /** Modules directory containing optional modules. */
  modulesDir: string;
  /** Modules to enable. */
  enabledModules: string[];
  /** Whether to overwrite existing files. */
  force?: boolean;
  /** Database configuration (required for env file generation). */
  dbConfig?: DbConfig;
}

/**
 * Result of template composition.
 */
export interface ComposedTemplate {
  /** List of files that were copied. */
  copiedFiles: string[];
  /** List of files that were merged. */
  mergedFiles: string[];
  /** List of files that were skipped. */
  skippedFiles: string[];
}

/**
 * Module definitions with their merge strategies.
 */
const MODULE_DEFINITIONS: Record<string, TemplateModule> = {
  hono: {
    name: "hono",
    mergeStrategy: "copy",
  },
  fresh: {
    name: "fresh",
    mergeStrategy: "copy",
    dependencies: [],
  },
  docker: {
    name: "docker",
    mergeStrategy: "copy",
  },
  ci: {
    name: "ci",
    mergeStrategy: "copy",
  },
  secrets: {
    name: "secrets",
    mergeStrategy: "copy",
  },
};

/**
 * Composes a TSera project from base template and optional modules.
 *
 * @param options - Composition options.
 * @returns Composition result with file statistics.
 *
 * @example
 * ```typescript
 * const result = await composeTemplate({
 *   targetDir: "/path/to/project",
 *   baseDir: "/templates/base",
 *   modulesDir: "/templates/modules",
 *   enabledModules: ["hono", "fresh", "docker"],
 * });
 * console.log(`Copied ${result.copiedFiles.length} files`);
 * ```
 */
export async function composeTemplate(
  options: ComposeOptions,
): Promise<ComposedTemplate> {
  const result: ComposedTemplate = {
    copiedFiles: [],
    mergedFiles: [],
    skippedFiles: [],
  };

  // Validate module dependencies
  validateModuleDependencies(options.enabledModules);

  // Copy base template first
  await copyDirectory(options.baseDir, options.targetDir, result, options.force);

  // Copy enabled modules
  for (const moduleName of options.enabledModules) {
    const moduleDir = join(options.modulesDir, moduleName);
    if (await exists(moduleDir)) {
      await copyDirectory(moduleDir, options.targetDir, result, options.force);
    }
  }

  // Merge special files that need intelligent merging
  await mergeConfigFiles(options, result);

  // Generate environment files if secrets module is enabled
  if (options.enabledModules.includes("secrets") && options.dbConfig) {
    await generateEnvironmentFiles(options, result);
  }

  // Generate .gitattributes for git-crypt if secrets module is enabled
  if (options.enabledModules.includes("secrets")) {
    await generateGitAttributes(options, result);
  }

  return result;
}

/**
 * Validates that all module dependencies are satisfied.
 *
 * @param enabledModules - List of enabled module names.
 * @throws {Error} If dependencies are not satisfied.
 */
function validateModuleDependencies(enabledModules: string[]): void {
  for (const moduleName of enabledModules) {
    const module = MODULE_DEFINITIONS[moduleName];
    if (!module) continue;

    if (module.dependencies) {
      for (const dep of module.dependencies) {
        if (!enabledModules.includes(dep)) {
          throw new Error(
            `Module "${moduleName}" requires "${dep}" to be enabled`,
          );
        }
      }
    }
  }
}

/**
 * Copies a directory recursively to the target.
 *
 * @param source - Source directory.
 * @param target - Target directory.
 * @param result - Composition result to update.
 * @param force - Whether to overwrite existing files.
 */
async function copyDirectory(
  source: string,
  target: string,
  result: ComposedTemplate,
  force = false,
): Promise<void> {
  for await (const entry of walk(source, { includeDirs: false })) {
    const relativePath = relative(source, entry.path);

    // Skip env.* files from template - they will be generated dynamically by generateEnvironmentFiles
    // Handle both Windows (\\) and Unix (/) path separators
    const pathSeparator = relativePath.includes("\\") ? "\\" : "/";
    const parts = relativePath.split(pathSeparator);
    const lastPart = parts[parts.length - 1];
    if (lastPart === "env.example" || lastPart === "env.dev" ||
      lastPart === "env.staging" || lastPart === "env.prod") {
      // Skip these files - they will be generated by generateEnvironmentFiles
      continue;
    }

    const targetPath = join(target, relativePath);

    // Skip deps files if they already exist (shared between modules)
    if (relativePath.startsWith("deps/") || relativePath.startsWith("deps\\")) {
      if (await exists(targetPath) && !force) {
        result.skippedFiles.push(relativePath);
        continue;
      }
    }

    // Check if file already exists
    if (await exists(targetPath) && !force) {
      result.skippedFiles.push(relativePath);
      continue;
    }

    // Ensure target directory exists
    await ensureDir(dirname(targetPath));

    // Copy the file
    await Deno.copyFile(entry.path, targetPath);
    result.copiedFiles.push(relativePath);
  }
}

/**
 * Merges configuration files that need intelligent merging.
 *
 * Currently handles:
 * - deno.jsonc (merge tasks)
 * - import_map.json (merge imports)
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
async function mergeConfigFiles(
  options: ComposeOptions,
  result: ComposedTemplate,
): Promise<void> {
  // Merge deno.jsonc if modules add tasks
  await mergeDenoConfig(options, result);

  // Merge import_map.json if modules add imports
  await mergeImportMap(options, result);
}

/**
 * Merges deno.jsonc files from enabled modules.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
/**
 * Type for Deno configuration file structure.
 */
interface DenoConfig {
  tasks?: Record<string, string>;
  imports?: Record<string, string>;
  compilerOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

async function mergeDenoConfig(
  options: ComposeOptions,
  result: ComposedTemplate,
): Promise<void> {
  const targetPath = join(options.targetDir, "deno.jsonc");
  if (!(await exists(targetPath))) return;

  let baseConfig: DenoConfig;
  try {
    const content = await Deno.readTextFile(targetPath);
    baseConfig = JSON.parse(content) as DenoConfig;
  } catch {
    return;
  }

  // Check each module for additional deno.jsonc
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "deno.jsonc");
    if (await exists(modulePath)) {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleConfig = JSON.parse(moduleContent);

      // Merge tasks
      const moduleConfigParsed = moduleConfig as DenoConfig;
      if (moduleConfigParsed.tasks) {
        baseConfig.tasks = {
          ...baseConfig.tasks,
          ...moduleConfigParsed.tasks,
        };
      }
    }
  }

  // Write merged config
  await Deno.writeTextFile(
    targetPath,
    JSON.stringify(baseConfig, null, 2) + "\n",
  );
  result.mergedFiles.push("deno.jsonc");
}

/**
 * Type for import map file structure.
 */
interface ImportMap {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

/**
 * Module-specific dependencies that should be added to import_map.json
 * when the module is enabled.
 */
const MODULE_DEPENDENCIES: Record<string, Record<string, string>> = {
  hono: {
    "hono": "jsr:@hono/hono@^4.0.0",
  },
  fresh: {
    "preact": "npm:preact@10.27.2",
    "preact/": "npm:preact@10.27.2/",
  },
};

/**
 * Merges import_map.json files from enabled modules and adds module-specific dependencies.
 * Removes dependencies from disabled modules to keep import_map.json clean.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
async function mergeImportMap(
  options: ComposeOptions,
  result: ComposedTemplate,
): Promise<void> {
  const targetPath = join(options.targetDir, "import_map.json");
  if (!(await exists(targetPath))) return;

  let baseMap: ImportMap;
  try {
    const content = await Deno.readTextFile(targetPath);
    baseMap = JSON.parse(content) as ImportMap;
  } catch {
    return;
  }

  // Ensure imports object exists
  if (!baseMap.imports) {
    baseMap.imports = {};
  }

  // Collect all dependencies that should be removed (from disabled modules)
  const dependenciesToRemove = new Set<string>();
  for (const [moduleName, deps] of Object.entries(MODULE_DEPENDENCIES)) {
    if (!options.enabledModules.includes(moduleName)) {
      // Module is disabled, mark its dependencies for removal
      for (const depKey of Object.keys(deps)) {
        dependenciesToRemove.add(depKey);
      }
    }
  }

  // Remove dependencies from disabled modules
  for (const depKey of dependenciesToRemove) {
    delete baseMap.imports[depKey];
  }

  // Add module-specific dependencies for enabled modules
  for (const moduleName of options.enabledModules) {
    if (MODULE_DEPENDENCIES[moduleName]) {
      baseMap.imports = { ...baseMap.imports, ...MODULE_DEPENDENCIES[moduleName] };
    }
  }

  // Check each module for additional imports from their import_map.json files (legacy support)
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "import_map.json");
    if (await exists(modulePath)) {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleMap = JSON.parse(moduleContent) as ImportMap;

      // Merge imports
      if (moduleMap.imports) {
        baseMap.imports = { ...baseMap.imports, ...moduleMap.imports };
      }
    }
  }

  // Sort imports for consistency
  // baseMap.imports is guaranteed to exist at this point
  const imports = baseMap.imports!;
  const sortedImports = Object.keys(imports)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = imports[key];
      return acc;
    }, {});

  baseMap.imports = sortedImports;

  // Write merged import map
  await Deno.writeTextFile(
    targetPath,
    JSON.stringify(baseMap, null, 2) + "\n",
  );
  result.mergedFiles.push("import_map.json");
}

/**
 * Gets the default templates root directory.
 *
 * @returns Absolute path to templates directory.
 */
export function getTemplatesRoot(): string {
  return fromFileUrl(new URL("../../../../../templates", import.meta.url));
}

/**
 * Gets available module names.
 *
 * @returns Array of module names.
 */
export function getAvailableModules(): string[] {
  return Object.keys(MODULE_DEFINITIONS);
}

/**
 * Generates environment files (.env.* and env.config.ts) for the secrets module.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
async function generateEnvironmentFiles(
  options: ComposeOptions,
  result: ComposedTemplate,
): Promise<void> {
  if (!options.dbConfig) return;

  // Create secrets directory in config
  const secretsDir = join(options.targetDir, "config", "secrets");
  await ensureDir(secretsDir);

  // Generate .env files
  const envFiles = generateEnvFiles({
    db: options.dbConfig,
    modules: options.enabledModules,
  });

  for (const [fileName, content] of Object.entries(envFiles)) {
    const filePath = join(secretsDir, fileName);
    await Deno.writeTextFile(filePath, content + "\n");
    result.copiedFiles.push(`config/secrets/${fileName}`);
  }

  // The env schema is now in config/secrets/manager.ts (no need to generate separately)
}

/**
 * Generates .gitattributes file for git-crypt encryption.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
async function generateGitAttributes(
  options: ComposeOptions,
  result: ComposedTemplate,
): Promise<void> {
  const gitattributesContent = `# TSera secrets encryption with git-crypt
# Install: https://github.com/AGWA/git-crypt
# Usage:
#   git-crypt init
#   git-crypt add-gpg-user <GPG_KEY_ID>

config/secrets/.env.* filter=git-crypt diff=git-crypt
.tsera/kv/** filter=git-crypt diff=git-crypt
.tsera/salt filter=git-crypt diff=git-crypt
`;

  const gitattributesPath = join(options.targetDir, ".gitattributes");
  await Deno.writeTextFile(gitattributesPath, gitattributesContent);
  result.copiedFiles.push(".gitattributes");
}
