/**
 * Template composition system for TSera projects.
 *
 * This module handles the composition of modular templates, allowing users
 * to enable or disable specific features (Hono, Lume, Docker, CI, Secrets)
 * through command-line flags.
 *
 * @module
 */

import { exists } from "std/fs";
import { parse as parseJsonc } from "std/jsonc";
import { fromFileUrl } from "../../../../shared/file-url.ts";
import { join } from "../../../../shared/path.ts";
import type { DbConfig } from "../../../definitions.ts";
import { ensureDir, safeWrite } from "../../../utils/fsx.ts";
import type { DenoConfig } from "./config-merger.ts";
import { mergeConfigFiles } from "./config-merger.ts";
import { copyDirectory } from "./directory-copier.ts";
import { generateEnvFiles } from "./env-generator.ts";
import { generateGitAttributes } from "./gitattributes-generator.ts";
import { generateLumeProject } from "./lume-generator.ts";
import { getAvailableModules, validateModuleDependencies } from "./module-definitions.ts";

// Re-export types for backward compatibility
export type { MergeStrategy, TemplateModule } from "./module-definitions.ts";

/**
 * Clears a directory by removing all files and subdirectories.
 *
 * @param dir - Directory path to clear.
 */
async function clearDirectory(dir: string): Promise<void> {
  if (!(await exists(dir))) {
    return;
  }

  for await (const entry of Deno.readDir(dir)) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory) {
      await Deno.remove(entryPath, { recursive: true });
    } else {
      await Deno.remove(entryPath);
    }
  }
}

/**
 * Options for template composition.
 */
export type ComposeOptions = {
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
};

/**
 * Result of template composition.
 */
export type ComposedTemplate = {
  /** List of files that were copied. */
  copiedFiles: string[];
  /** List of files that were merged. */
  mergedFiles: string[];
  /** List of files that were skipped. */
  skippedFiles: string[];
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
 *   enabledModules: ["hono", "lume", "docker"],
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
  await copyDirectory({
    source: options.baseDir,
    target: options.targetDir,
    result,
    force: options.force,
  });

  // Copy enabled modules (except Lume which is generated dynamically, and secrets which is handled specially)
  for (const moduleName of options.enabledModules) {
    if (moduleName === "lume") {
      // Lume is generated dynamically via lume init
      continue;
    }
    if (moduleName === "secrets") {
      // Secrets module is handled separately in generateEnvironmentFiles
      continue;
    }
    const moduleDir = join(options.modulesDir, moduleName);
    if (await exists(moduleDir)) {
      await copyDirectory({
        source: moduleDir,
        target: options.targetDir,
        result,
        force: options.force,
      });
    }
  }

  // Generate Lume project if enabled (before merging configs so we can read deno.jsonc)
  let lumeDenoConfig: DenoConfig | null = null;
  if (options.enabledModules.includes("lume")) {
    const lumeTargetDir = join(options.targetDir, "app", "front");
    await ensureDir(lumeTargetDir);
    const lumeFiles = await generateLumeProject({
      targetDir: lumeTargetDir,
      projectRootDir: options.targetDir,
      force: options.force,
    });
    result.copiedFiles.push(...lumeFiles.map((f: string) => `app/front/${f}`));

    // Remove .vscode/ directory from app/front/ if it exists
    const vscodeFrontDir = join(lumeTargetDir, ".vscode");
    if (await exists(vscodeFrontDir)) {
      await Deno.remove(vscodeFrontDir, { recursive: true });
    }

    // Read Lume deno.jsonc directly from template (not from generated files)
    const lumeTemplateDenoPath = join(options.modulesDir, "lume", "deno.jsonc");
    if (await exists(lumeTemplateDenoPath)) {
      try {
        const lumeContent = await Deno.readTextFile(lumeTemplateDenoPath);
        lumeDenoConfig = parseJsonc(lumeContent) as DenoConfig;
      } catch {
        // Ignore errors
      }
    }

    // Copy TSera-specific Lume template files from templates/modules/lume/
    // These files contain custom pages, layouts, and static assets
    // Files are copied directly to app/front/ to match Lume's default structure
    const lumeTemplateDir = join(options.modulesDir, "lume");
    if (await exists(lumeTemplateDir)) {
      // Clear target directories before copying to ensure clean state
      // Lume uses src/ for pages, components, and assets
      await clearDirectory(join(lumeTargetDir, "src"));
      await clearDirectory(join(lumeTargetDir, "assets"));
      await clearDirectory(join(lumeTargetDir, "_includes"));

      await copyDirectory({
        source: lumeTemplateDir,
        target: lumeTargetDir,
        result,
        force: options.force,
      });
    }
  }

  // Merge special files that need intelligent merging
  await mergeConfigFiles(options, result, lumeDenoConfig);

  // Generate environment files if secrets module is enabled
  if (options.enabledModules.includes("secrets") && options.dbConfig) {
    await generateEnvironmentFiles(options, result);
  }

  // Generate .gitattributes for git-crypt if secrets module is enabled
  if (options.enabledModules.includes("secrets")) {
    await generateGitAttributes({
      targetDir: options.targetDir,
      result,
    });
  }

  return result;
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
export { getAvailableModules };

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

  // Create secret directory in config (singular "secret" with 's' at the end)
  const secretDir = join(options.targetDir, "config", "secret");
  await ensureDir(secretDir);

  // Generate .env files
  const envFiles = generateEnvFiles({
    db: options.dbConfig,
    modules: options.enabledModules,
  });

  for (const [fileName, content] of Object.entries(envFiles)) {
    const filePath = join(secretDir, fileName);
    await safeWrite(filePath, content + "\n");
    result.copiedFiles.push(`config/secret/${fileName}`);
  }

  // Copy env.config.ts from templates/modules/secrets/ to config/secret/
  const envConfigSource = join(options.modulesDir, "secrets", "env.config.ts");
  const envConfigTarget = join(secretDir, "env.config.ts");
  if (await exists(envConfigSource)) {
    let content = await Deno.readTextFile(envConfigSource);
    // Replace local import with JSR import for generated projects
    content = content.replace(
      /from ["']\.\.\/\.\.\/\.\.\/src\/core\/secrets\.ts["']/,
      'from "tsera/core"',
    );
    await safeWrite(envConfigTarget, content);
    result.copiedFiles.push("config/secret/env.config.ts");
  }

  // Copy defineEnvConfig.ts from templates/modules/secrets/ to config/secret/
  const defineEnvConfigSource = join(options.modulesDir, "secrets", "defineEnvConfig.ts");
  const defineEnvConfigTarget = join(secretDir, "defineEnvConfig.ts");
  if (await exists(defineEnvConfigSource)) {
    const defineEnvContent = await Deno.readTextFile(defineEnvConfigSource);
    await safeWrite(defineEnvConfigTarget, defineEnvContent);
    result.copiedFiles.push("config/secret/defineEnvConfig.ts");
  }
}
