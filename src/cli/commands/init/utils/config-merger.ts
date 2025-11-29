/**
 * Configuration file merging utilities for template composition.
 *
 * This module handles intelligent merging of configuration files like
 * deno.jsonc and import_map.json when composing templates from multiple modules.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import { exists } from "std/fs";
import { parse as parseJsonc } from "jsr:@std/jsonc@1";
import type { ComposedTemplate, ComposeOptions } from "./template-composer.ts";
import { MODULE_DEPENDENCIES } from "./module-definitions.ts";

/**
 * Type for Deno configuration file structure.
 */
export interface DenoConfig {
  tasks?: Record<string, string>;
  imports?: Record<string, string>;
  compilerOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Type for import map file structure.
 */
export interface ImportMap {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
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
 * @param freshDenoConfig - Optional Fresh deno.json configuration to merge.
 */
export async function mergeConfigFiles(
  options: ComposeOptions,
  result: ComposedTemplate,
  freshDenoConfig?: DenoConfig | null,
): Promise<void> {
  // Merge deno.jsonc if modules add tasks
  await mergeDenoConfig(options, result, freshDenoConfig);

  // Merge import_map.json if modules add imports
  await mergeImportMap(options, result);
}

/**
 * Merges deno.jsonc files from enabled modules.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 * @param freshDenoConfig - Optional Fresh deno.json configuration to merge.
 */
async function mergeDenoConfig(
  options: ComposeOptions,
  result: ComposedTemplate,
  freshDenoConfig?: DenoConfig | null,
): Promise<void> {
  const targetPath = join(options.targetDir, "deno.jsonc");
  if (!(await exists(targetPath))) return;

  let baseConfig: DenoConfig;
  try {
    const content = await Deno.readTextFile(targetPath);
    baseConfig = parseJsonc(content) as DenoConfig;
  } catch {
    return;
  }

  // Check each module for additional deno.jsonc
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "deno.jsonc");
    if (await exists(modulePath)) {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleConfig = parseJsonc(moduleContent);

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

  // Merge Fresh deno.json if Fresh module is enabled
  if (options.enabledModules.includes("fresh") && freshDenoConfig) {
    // Change nodeModulesDir from "auto" to "manual" for Fresh/Vite compatibility
    baseConfig.nodeModulesDir = "manual";

    // Use importMap to reference import_map.json instead of duplicating imports
    // This avoids duplication and keeps import_map.json as the single source of truth
    const importMapPath = join(options.targetDir, "import_map.json");
    if (await exists(importMapPath)) {
      baseConfig.importMap = "import_map.json";
      // Remove imports from deno.jsonc since we're using importMap
      delete baseConfig.imports;
    }

    // Merge Fresh tasks
    if (freshDenoConfig.tasks) {
      baseConfig.tasks = {
        ...baseConfig.tasks,
        "dev:front": "deno run -A --import-map=import_map.json npm:vite@^7.1.3 --config config/front/vite.config.ts",
        "build:front": "deno run -A --import-map=import_map.json npm:vite@^7.1.3 build --config config/front/vite.config.ts",
        "start:front": "deno serve -A _fresh/server.js",
      };
    }

    // Merge compiler options (Fresh uses jsx: "precompile") and add vite/client types
    if (freshDenoConfig.compilerOptions) {
      baseConfig.compilerOptions = {
        ...baseConfig.compilerOptions,
        ...freshDenoConfig.compilerOptions,
        types: ["vite/client"],
      };
    }

    // Merge lint rules
    if (freshDenoConfig.lint) {
      baseConfig.lint = freshDenoConfig.lint;
    }

    // Remove Fresh deno.json after merging (it's not needed in app/front/)
    const freshDenoPath = join(options.targetDir, "app", "front", "deno.json");
    if (await exists(freshDenoPath)) {
      try {
        await Deno.remove(freshDenoPath);
      } catch {
        // Ignore errors
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

  // If import_map.json doesn't exist, copy it from the base template first
  if (!(await exists(targetPath))) {
    const baseImportMapPath = join(options.baseDir, "import_map.json");
    if (await exists(baseImportMapPath)) {
      const baseContent = await Deno.readTextFile(baseImportMapPath);
      await Deno.writeTextFile(targetPath, baseContent);
      result.copiedFiles.push("import_map.json");
    } else {
      // If base template doesn't have import_map.json, create a minimal one
      const minimalImportMap: ImportMap = { imports: {} };
      await Deno.writeTextFile(
        targetPath,
        JSON.stringify(minimalImportMap, null, 2) + "\n",
      );
      result.copiedFiles.push("import_map.json");
    }
  }

  let baseMap: ImportMap;
  try {
    const content = await Deno.readTextFile(targetPath);
    baseMap = parseJsonc(content) as ImportMap;
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
      const moduleMap = parseJsonc(moduleContent) as ImportMap;

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

  // Write merged import map (always, for both Fresh and non-Fresh projects)
  // For Fresh projects, deno.jsonc will reference this via importMap field
  // For non-Fresh projects, this is the primary import map
  await Deno.writeTextFile(
    targetPath,
    JSON.stringify(baseMap, null, 2) + "\n",
  );
  result.mergedFiles.push("import_map.json");

  // For Fresh projects, ensure deno.jsonc uses importMap to reference import_map.json
  // This avoids duplication - imports are only in import_map.json
  // Note: When using --import-map in command line, Deno will ignore importMap in deno.jsonc
  // This is fine - importMap in deno.jsonc is for Deno commands without --import-map,
  // and --import-map is needed for vite to work correctly
  if (options.enabledModules.includes("fresh")) {
    const denoConfigPath = join(options.targetDir, "deno.jsonc");
    if (await exists(denoConfigPath)) {
      try {
        const denoContent = await Deno.readTextFile(denoConfigPath);
        const denoConfig = parseJsonc(denoContent) as DenoConfig;

        // Set importMap to reference import_map.json (avoid duplication)
        // This will be used by Deno commands that don't specify --import-map
        denoConfig.importMap = "import_map.json";
        // Remove imports from deno.jsonc since we're using importMap
        if (denoConfig.imports) {
          delete denoConfig.imports;
        }

        // Write updated config
        await Deno.writeTextFile(
          denoConfigPath,
          JSON.stringify(denoConfig, null, 2) + "\n",
        );
      } catch (error) {
        console.error("Failed to update deno.jsonc with importMap:", error);
      }
    }
  }
}
