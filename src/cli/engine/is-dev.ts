/**
 * Development mode detection and configuration utilities.
 *
 * This module centralizes the logic for detecting whether a project is being
 * created inside the TSera repository (development mode) and provides utilities
 * to apply the necessary configuration changes for local development.
 *
 * When in development mode:
 * - JSR imports are replaced with relative paths to local source files
 * - CLI task aliases are patched to use local CLI source instead of JSR
 *
 * @module cli/engine/is-dev
 */

import { dirname, join, relative, resolve } from "../../shared/path.ts";
import { exists } from "std/fs";
import { parse as parseJsonc } from "std/jsonc";
import { normalizeNewlines } from "../../shared/newline.ts";
import { safeWrite } from "../utils/fsx.ts";
import type { DenoConfig } from "../commands/init/utils/config-merger.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result type for dev mode patching operations.
 *
 * @example
 * ```typescript
 * const result = await patchForDevMode("./demo", "./templates");
 * if (result.isDevMode) {
 *   console.log("Modified files:", result.modifiedFiles);
 * }
 * ```
 */
export type DevModePatchResult = {
  /** Whether development mode was detected (project inside TSera repo). */
  isDevMode: boolean;
  /** List of files that were modified during patching. */
  modifiedFiles: string[];
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Checks if the target directory is inside the TSera repository.
 *
 * This detection is used to determine whether to apply development mode
 * patches to the generated project configuration.
 *
 * @param targetDir - Absolute or relative path to the project being created.
 * @param templatesRoot - Absolute or relative path to the templates directory.
 * @returns `true` if targetDir is inside the TSera repository, `false` otherwise.
 *
 * @example
 * ```typescript
 * // Inside TSera repo
 * isInsideTSeraRepo("./demo", "./templates"); // true
 *
 * // Outside TSera repo
 * isInsideTSeraRepo("/home/user/my-project", "/opt/tsera/templates"); // false
 * ```
 */
export function isInsideTSeraRepo(
  targetDir: string,
  templatesRoot: string,
): boolean {
  // templatesRoot is .../templates, go up one level to get repo root
  const repoRoot = dirname(templatesRoot);

  // Normalize both paths for comparison (handle Windows/POSIX differences)
  const normalizedTarget = resolve(targetDir).replace(/\\/g, "/");
  const normalizedRoot = resolve(repoRoot).replace(/\\/g, "/");

  // Check if target is inside repo root
  return (
    normalizedTarget.startsWith(normalizedRoot + "/") ||
    normalizedTarget === normalizedRoot
  );
}

/**
 * Patches the deno.jsonc in the target directory for development mode.
 *
 * When in dev mode (inside TSera repo), this function:
 * 1. Replaces `@tsera/core` JSR import with relative path to local source
 * 2. Patches the "tsera" task to use local CLI source instead of JSR
 *
 * @param targetDir - Target directory for the project.
 * @param templatesRoot - Path to templates directory (used to calculate repo root).
 * @returns Result indicating if dev mode was detected and what files were modified.
 *
 * @example
 * ```typescript
 * const result = await patchForDevMode("./demo", "./templates");
 * console.log(`Dev mode: ${result.isDevMode}`);
 * console.log(`Modified: ${result.modifiedFiles.join(", ")}`);
 * ```
 */
export async function patchForDevMode(
  targetDir: string,
  templatesRoot: string,
): Promise<DevModePatchResult> {
  const isDevMode = isInsideTSeraRepo(targetDir, templatesRoot);

  // If not in dev mode, no changes needed
  if (!isDevMode) {
    return { isDevMode: false, modifiedFiles: [] };
  }

  const modifiedFiles: string[] = [];
  const repoRoot = dirname(templatesRoot);
  const denoConfigPath = join(targetDir, "deno.jsonc");

  if (!(await exists(denoConfigPath))) {
    return { isDevMode: true, modifiedFiles };
  }

  // Read and parse deno.jsonc
  const content = await Deno.readTextFile(denoConfigPath);
  let denoConfig: DenoConfig;

  try {
    denoConfig = parseJsonc(content) as DenoConfig;
  } catch {
    return { isDevMode: true, modifiedFiles };
  }

  if (!denoConfig.imports) {
    return { isDevMode: true, modifiedFiles };
  }

  let configModified = false;

  // Patch @tsera/core import
  configModified = patchCoreImport(denoConfig, repoRoot, targetDir) || configModified;

  // Patch "tsera" task
  configModified = patchTseraTask(denoConfig, repoRoot, targetDir) || configModified;

  // Write changes if any modifications were made
  if (configModified) {
    const updatedContent = JSON.stringify(denoConfig, null, 2) + "\n";
    await safeWrite(denoConfigPath, normalizeNewlines(updatedContent));
    modifiedFiles.push("deno.jsonc");
  }

  return { isDevMode: true, modifiedFiles };
}

// ============================================================================
// Private Functions
// ============================================================================

/**
 * Patches the @tsera/core import to use local source.
 *
 * @param denoConfig - Deno configuration to patch (modified in place).
 * @param repoRoot - Path to TSera repository root.
 * @param targetDir - Path to target project directory.
 * @returns `true` if the configuration was modified, `false` otherwise.
 */
function patchCoreImport(
  denoConfig: DenoConfig,
  repoRoot: string,
  targetDir: string,
): boolean {
  const coreImport = denoConfig.imports?.["@tsera/core"];

  if (
    !coreImport ||
    typeof coreImport !== "string" ||
    !coreImport.startsWith("jsr:@tsera/")
  ) {
    return false;
  }

  // Calculate relative path from target to core/index.ts
  const coreIndexPath = join(repoRoot, "src", "core", "index.ts");
  const relativePath = calculateRelativePath(targetDir, coreIndexPath);

  denoConfig.imports!["@tsera/core"] = relativePath;
  return true;
}

/**
 * Patches the "tsera" task to use local CLI source.
 *
 * @param denoConfig - Deno configuration to patch (modified in place).
 * @param repoRoot - Path to TSera repository root.
 * @param targetDir - Path to target project directory.
 * @returns `true` if the configuration was modified, `false` otherwise.
 */
function patchTseraTask(
  denoConfig: DenoConfig,
  repoRoot: string,
  targetDir: string,
): boolean {
  const tasks = denoConfig.tasks;
  const tseraTask = tasks?.tsera;

  if (
    !tasks ||
    !tseraTask ||
    typeof tseraTask !== "string" ||
    !tseraTask.includes("jsr:@tsera/cli")
  ) {
    return false;
  }

  // Calculate relative path from target to CLI main.ts
  const cliMainPath = join(repoRoot, "src", "cli", "main.ts");
  const relativePath = calculateRelativePath(targetDir, cliMainPath);

  tasks.tsera = `deno run -A ${relativePath}`;
  return true;
}

/**
 * Calculates the relative path from a source directory to a target file.
 *
 * This function handles cross-platform path differences and ensures
 * consistent forward-slash paths in the output.
 *
 * @param fromDir - Source directory path.
 * @param toFile - Target file path.
 * @returns Relative path from source directory to target file.
 */
function calculateRelativePath(fromDir: string, toFile: string): string {
  const absoluteFromDir = resolve(fromDir);
  const absoluteToFile = resolve(toFile);

  // Use built-in relative function
  const relPath = relative(absoluteFromDir, absoluteToFile);

  // Normalize to forward slashes for consistency
  return relPath.replace(/\\/g, "/");
}
