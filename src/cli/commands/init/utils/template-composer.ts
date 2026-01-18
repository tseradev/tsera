/**
 * Template composition system for TSera projects.
 *
 * This module handles the composition of modular templates, allowing users
 * to enable or disable specific features (Hono, Lume, Docker, CI, Secrets)
 * through command-line flags.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import { fromFileUrl } from "../../../../shared/file-url.ts";
import { exists } from "std/fs";
import { ensureDir } from "../../../utils/fsx.ts";
import type { DbConfig } from "../../../definitions.ts";
import { generateEnvFiles } from "./env-generator.ts";
import { generateFreshProject } from "./fresh-generator.ts";
import { parse as parseJsonc } from "jsr:@std/jsonc@1";
import { getAvailableModules, validateModuleDependencies } from "./module-definitions.ts";
import { copyDirectory } from "./directory-copier.ts";
import { mergeConfigFiles } from "./config-merger.ts";
import type { DenoConfig } from "./config-merger.ts";
import { generateGitAttributes } from "./gitattributes-generator.ts";

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

  // Copy enabled modules (except Lume which is generated dynamically)
  for (const moduleName of options.enabledModules) {
    if (moduleName === "lume") {
      // Lume is generated dynamically via lume init
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

  // Generate Lume project if enabled (before merging configs so we can read deno.json)
  let lumeDenoConfig: DenoConfig | null = null;
  if (options.enabledModules.includes("lume")) {
    const freshTargetDir = join(options.targetDir, "app", "front");
    await ensureDir(freshTargetDir);
    const freshFiles = await generateFreshProject({
      targetDir: freshTargetDir,
      force: options.force,
    });
    result.copiedFiles.push(...freshFiles.map((f: string) => `app/front/${f}`));

    // Read Lume deno.json before it gets removed
    const freshDenoPath = join(freshTargetDir, "deno.json");
    if (await exists(freshDenoPath)) {
      try {
        const freshContent = await Deno.readTextFile(freshDenoPath);
        lumeDenoConfig = parseJsonc(freshContent) as DenoConfig;
      } catch {
        // Ignore errors
      }
    }

    // Copy TSera-specific Lume template files from templates/modules/lume/
    // These files contain custom components, pages, and static assets
    // Files are copied directly to app/front/ to match Lume's default structure
    const freshTemplateDir = join(options.modulesDir, "lume");
    if (await exists(freshTemplateDir)) {
      // Clear target directories before copying to ensure clean state
      await clearDirectory(join(freshTargetDir, "components"));
      await clearDirectory(join(freshTargetDir, "islands"));
      await clearDirectory(join(freshTargetDir, "routes"));
      await clearDirectory(join(freshTargetDir, "static"));

      await copyDirectory({
        source: freshTemplateDir,
        target: freshTargetDir,
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
