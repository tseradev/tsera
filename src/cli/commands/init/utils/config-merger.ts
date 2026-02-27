/**
 * Configuration file merging utilities for template composition.
 *
 * This module handles intelligent merging of configuration files like
 * deno.jsonc when composing templates from multiple modules. It provides
 * utilities to merge tasks, imports, and other configuration properties
 * from base templates and optional modules into a unified configuration.
 *
 * @module cli/commands/init/utils/config-merger
 */

import { exists } from "std/fs";
import { parse as parseJsonc } from "std/jsonc";
import { join } from "../../../../shared/path.ts";
import { safeWrite } from "../../../utils/fsx.ts";
import type { ComposedTemplate, ComposeOptions } from "./template-composer.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a Deno configuration file structure (deno.jsonc).
 *
 * This type covers the most commonly used properties in Deno configuration
 * files while allowing additional properties through the index signature.
 *
 * @example
 * ```typescript
 * const config: DenoConfig = {
 *   tasks: {
 *     dev: "deno run -A src/main.ts",
 *     test: "deno test -A"
 *   },
 *   imports: {
 *     "@std/fs": "jsr:@std/fs@^1.0.0"
 *   }
 * };
 * ```
 */
export type DenoConfig = {
  /** Task definitions for `deno task` commands. */
  tasks?: Record<string, string>;
  /** Import map entries for module resolution. */
  imports?: Record<string, string>;
  /** TypeScript compiler configuration options. */
  compilerOptions?: Record<string, unknown>;
  /** Additional properties not explicitly typed. */
  [key: string]: unknown;
};

/**
 * Represents an import map file structure (import_map.json).
 *
 * Import maps allow fine-grained control over module resolution with
 * support for scoped overrides.
 *
 * @example
 * ```typescript
 * const importMap: ImportMap = {
 *   imports: {
 *     "lodash": "npm:lodash@^4.17.0"
 *   },
 *   scopes: {
 *     "./legacy/": {
 *       "lodash": "npm:lodash@^3.10.0"
 *     }
 *   }
 * };
 * ```
 */
export type ImportMap = {
  /** Top-level import mappings. */
  imports?: Record<string, string>;
  /** Scope-specific import mappings. */
  scopes?: Record<string, Record<string, string>>;
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Merges configuration files that need intelligent merging.
 *
 * This function orchestrates the merging of all configuration files in a
 * newly composed project. It handles:
 * - deno.jsonc: Merges tasks and imports from all enabled modules
 * - import_map.json: Deletes if present (migration to deno.jsonc imports)
 *
 * @param options - Composition options containing target directory and module selections.
 * @param result - Composition result to update with information about merged files.
 * @param lumeDenoConfig - Optional Lume deno.json configuration to merge when Lume module is enabled.
 *
 * @example
 * ```typescript
 * await mergeConfigFiles(options, result, lumeConfig);
 * // Result now contains information about which files were merged
 * console.log(result.mergedFiles); // ["deno.jsonc"]
 * ```
 */
export async function mergeConfigFiles(
  options: ComposeOptions,
  result: ComposedTemplate,
  lumeDenoConfig?: DenoConfig | null,
): Promise<void> {
  await mergeDenoConfig(options, result, lumeDenoConfig);
  await mergeImportsIntoDenoConfig(options);
  await cleanupLegacyImportMap(options);
}

// ============================================================================
// Private Functions
// ============================================================================

/**
 * Merges deno.jsonc files from enabled modules into the base configuration.
 *
 * This function performs the following operations:
 * 1. Reads the base deno.jsonc from the target directory
 * 2. Merges tasks and imports from each enabled module's deno.jsonc
 * 3. Handles special merging for Lume module configuration
 * 4. Writes the merged configuration back to the target directory
 *
 * @param options - Composition options containing target directory and module selections.
 * @param result - Composition result to update with information about merged files.
 * @param lumeDenoConfig - Optional Lume deno.json configuration for special handling.
 */
async function mergeDenoConfig(
  options: ComposeOptions,
  result: ComposedTemplate,
  lumeDenoConfig?: DenoConfig | null,
): Promise<void> {
  const targetPath = join(options.targetDir, "deno.jsonc");
  if (!(await exists(targetPath))) {
    return;
  }

  let baseConfig: DenoConfig;
  try {
    const content = await Deno.readTextFile(targetPath);
    baseConfig = parseJsonc(content) as DenoConfig;
  } catch {
    return;
  }

  // Merge configurations from each enabled module
  await mergeModuleConfigs(options, baseConfig);

  // Special handling for Lume module
  if (options.enabledModules.includes("lume") && lumeDenoConfig) {
    mergeLumeConfig(baseConfig, lumeDenoConfig);
  }

  // Write merged configuration
  const writeResult = await safeWrite(
    targetPath,
    JSON.stringify(baseConfig, null, 2) + "\n",
  );
  if (writeResult.changed) {
    result.mergedFiles.push("deno.jsonc");
  }
}

/**
 * Merges deno.jsonc configurations from all enabled modules.
 *
 * @param options - Composition options containing module selections.
 * @param baseConfig - Base configuration to merge into (modified in place).
 */
async function mergeModuleConfigs(
  options: ComposeOptions,
  baseConfig: DenoConfig,
): Promise<void> {
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "deno.jsonc");
    if (!(await exists(modulePath))) {
      continue;
    }

    try {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleConfig = parseJsonc(moduleContent) as DenoConfig;

      // Merge tasks from module
      if (moduleConfig.tasks) {
        baseConfig.tasks = {
          ...baseConfig.tasks,
          ...moduleConfig.tasks,
        };
      }

      // Merge imports from module (except Lume which is handled separately)
      if (moduleConfig.imports && moduleName !== "lume") {
        baseConfig.imports = {
          ...(baseConfig.imports || {}),
          ...moduleConfig.imports,
        };
      }
    } catch {
      // Skip modules with invalid deno.jsonc
    }
  }
}

/**
 * Merges Lume-specific configuration into the base configuration.
 *
 * Lume requires special handling because it has many configuration options
 * that need to be properly merged, including permissions, compiler options,
 * and unstable flags.
 *
 * @param baseConfig - Base configuration to merge into (modified in place).
 * @param lumeConfig - Lume configuration to merge from.
 */
function mergeLumeConfig(baseConfig: DenoConfig, lumeConfig: DenoConfig): void {
  // Merge imports (critical for Lume module resolution)
  if (lumeConfig.imports) {
    baseConfig.imports = {
      ...(baseConfig.imports || {}),
      ...lumeConfig.imports,
    };
  }

  // Merge permissions (critical for -P=lume flag)
  if (lumeConfig.permissions) {
    baseConfig.permissions = {
      ...(baseConfig.permissions || {}),
      ...lumeConfig.permissions,
    };
  }

  // Merge compilerOptions (JSX configuration)
  if (lumeConfig.compilerOptions) {
    baseConfig.compilerOptions = {
      ...(baseConfig.compilerOptions || {}),
      ...lumeConfig.compilerOptions,
    };
  }

  // Merge Lume tasks
  if (lumeConfig.tasks) {
    baseConfig.tasks = { ...baseConfig.tasks, ...lumeConfig.tasks };
  }

  // Merge unstable flags
  if (lumeConfig.unstable !== undefined) {
    baseConfig.unstable = lumeConfig.unstable;
  }

  // Merge lint rules
  if (lumeConfig.lint !== undefined) {
    baseConfig.lint = lumeConfig.lint;
  }

  // Merge lock configuration
  if (lumeConfig.lock !== undefined) {
    baseConfig.lock = lumeConfig.lock;
  }
}

/**
 * Merges module dependencies into deno.jsonc imports.
 *
 * This function ensures that:
 * 1. Base dependencies from templates/base/deno.jsonc are included
 * 2. Dependencies from enabled modules are added
 * 3. Dependencies from disabled modules are removed
 * 4. Legacy import_map.json files are merged (for backward compatibility)
 * 5. Imports are sorted alphabetically for consistency
 *
 * @param options - Composition options containing target directory and module selections.
 */
async function mergeImportsIntoDenoConfig(
  options: ComposeOptions,
): Promise<void> {
  const denoConfigPath = join(options.targetDir, "deno.jsonc");
  if (!(await exists(denoConfigPath))) {
    return;
  }

  let denoConfig: DenoConfig;
  try {
    const content = await Deno.readTextFile(denoConfigPath);
    denoConfig = parseJsonc(content) as DenoConfig;
  } catch {
    return;
  }

  // Ensure imports object exists
  if (!denoConfig.imports) {
    denoConfig.imports = {};
  }

  // Merge base dependencies from templates/base/deno.jsonc
  await mergeBaseDependencies(options, denoConfig);

  // Get all available modules
  const allModules = await getAvailableModules(options.modulesDir);

  // Remove imports from disabled modules
  await removeDisabledModuleImports(options, allModules, denoConfig);

  // Add imports from enabled modules
  await mergeEnabledModuleImports(options, denoConfig);

  // Merge legacy import_map.json files for backward compatibility
  await mergeLegacyImportMaps(options, denoConfig);

  // Sort imports alphabetically for consistency
  denoConfig.imports = sortImports(denoConfig.imports);

  // Remove importMap field (migrated to inline imports)
  delete denoConfig.importMap;

  // Write merged configuration
  await safeWrite(
    denoConfigPath,
    JSON.stringify(denoConfig, null, 2) + "\n",
  );
}

/**
 * Merges base dependencies from templates/base/deno.jsonc.
 *
 * @param options - Composition options containing base directory path.
 * @param denoConfig - Configuration to merge into (modified in place).
 */
async function mergeBaseDependencies(
  options: ComposeOptions,
  denoConfig: DenoConfig,
): Promise<void> {
  const baseDenoConfigPath = join(options.baseDir, "deno.jsonc");
  if (!(await exists(baseDenoConfigPath))) {
    return;
  }

  try {
    const baseContent = await Deno.readTextFile(baseDenoConfigPath);
    const baseConfig = parseJsonc(baseContent) as DenoConfig;
    if (baseConfig.imports) {
      denoConfig.imports = {
        ...denoConfig.imports,
        ...baseConfig.imports,
      };
    }
  } catch {
    // Skip if base config cannot be read
  }
}

/**
 * Gets the list of all available modules by scanning the modules directory.
 *
 * @param modulesDir - Path to the modules directory.
 * @returns Array of module names.
 */
async function getAvailableModules(modulesDir: string): Promise<string[]> {
  const modules: string[] = [];
  try {
    for await (const entry of Deno.readDir(modulesDir)) {
      if (entry.isDirectory) {
        modules.push(entry.name);
      }
    }
  } catch {
    // Return empty array if directory cannot be read
  }
  return modules;
}

/**
 * Removes imports from disabled modules.
 *
 * @param options - Composition options containing enabled modules.
 * @param allModules - List of all available modules.
 * @param denoConfig - Configuration to clean up (modified in place).
 */
async function removeDisabledModuleImports(
  options: ComposeOptions,
  allModules: string[],
  denoConfig: DenoConfig,
): Promise<void> {
  const importsToRemove = new Set<string>();

  for (const moduleName of allModules) {
    if (options.enabledModules.includes(moduleName)) {
      continue;
    }

    const moduleDenoConfigPath = join(options.modulesDir, moduleName, "deno.jsonc");
    if (!(await exists(moduleDenoConfigPath))) {
      continue;
    }

    try {
      const moduleContent = await Deno.readTextFile(moduleDenoConfigPath);
      const moduleConfig = parseJsonc(moduleContent) as DenoConfig;
      if (moduleConfig.imports) {
        for (const key of Object.keys(moduleConfig.imports)) {
          importsToRemove.add(key);
        }
      }
    } catch {
      // Skip modules with invalid configuration
    }
  }

  for (const importKey of importsToRemove) {
    if (denoConfig.imports) {
      delete denoConfig.imports[importKey];
    }
  }
}

/**
 * Merges imports from enabled modules.
 *
 * @param options - Composition options containing enabled modules.
 * @param denoConfig - Configuration to merge into (modified in place).
 */
async function mergeEnabledModuleImports(
  options: ComposeOptions,
  denoConfig: DenoConfig,
): Promise<void> {
  for (const moduleName of options.enabledModules) {
    const moduleDenoConfigPath = join(options.modulesDir, moduleName, "deno.jsonc");
    if (!(await exists(moduleDenoConfigPath))) {
      continue;
    }

    try {
      const moduleContent = await Deno.readTextFile(moduleDenoConfigPath);
      const moduleConfig = parseJsonc(moduleContent) as DenoConfig;
      if (moduleConfig.imports) {
        denoConfig.imports = { ...denoConfig.imports, ...moduleConfig.imports };
      }
    } catch {
      // Skip modules with invalid configuration
    }
  }
}

/**
 * Merges imports from legacy import_map.json files.
 *
 * This provides backward compatibility for modules that still use
 * import_map.json instead of deno.jsonc imports.
 *
 * @param options - Composition options containing enabled modules.
 * @param denoConfig - Configuration to merge into (modified in place).
 */
async function mergeLegacyImportMaps(
  options: ComposeOptions,
  denoConfig: DenoConfig,
): Promise<void> {
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "import_map.json");
    if (!(await exists(modulePath))) {
      continue;
    }

    try {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleMap = parseJsonc(moduleContent) as ImportMap;
      if (moduleMap.imports) {
        denoConfig.imports = { ...denoConfig.imports, ...moduleMap.imports };
      }
    } catch {
      // Skip invalid import map files
    }
  }
}

/**
 * Sorts imports alphabetically for consistency.
 *
 * @param imports - Import map to sort.
 * @returns New object with sorted keys.
 */
function sortImports(imports: Record<string, string>): Record<string, string> {
  return Object.keys(imports)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = imports[key];
      return acc;
    }, {});
}

/**
 * Removes legacy import_map.json file if it exists.
 *
 * This is part of the migration from import_map.json to inline imports
 * in deno.jsonc.
 *
 * @param options - Composition options containing target directory.
 */
async function cleanupLegacyImportMap(options: ComposeOptions): Promise<void> {
  const importMapPath = join(options.targetDir, "import_map.json");
  if (!(await exists(importMapPath))) {
    return;
  }

  try {
    await Deno.remove(importMapPath);
  } catch {
    // Ignore errors during cleanup
  }
}
