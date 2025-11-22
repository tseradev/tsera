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
import type { ComposeOptions, ComposedTemplate } from "./template-composer.ts";
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

    // Remove importMap field if present and move imports to root
    if (baseConfig.importMap) {
      delete baseConfig.importMap;
    }

    // Merge Fresh tasks
    if (freshDenoConfig.tasks) {
      baseConfig.tasks = {
        ...baseConfig.tasks,
        "dev:front": "vite --config config/front/vite.config.ts",
        "build:front": "vite build --config config/front/vite.config.ts",
        "start:front": "deno serve -A _fresh/server.js",
      };
    }

    // Import everything from import_map.json and merge with Fresh imports
    const importMapPath = join(options.targetDir, "import_map.json");
    if (await exists(importMapPath)) {
      try {
        const importMapContent = await Deno.readTextFile(importMapPath);
        const importMap = parseJsonc(importMapContent) as { imports?: Record<string, string> };
        baseConfig.imports = {
          ...baseConfig.imports,
          ...(importMap.imports || {}),
        };
      } catch {
        // Ignore errors
      }
    }

    // Merge Fresh imports into deno.jsonc imports
    if (freshDenoConfig.imports) {
      baseConfig.imports = {
        ...baseConfig.imports,
        ...freshDenoConfig.imports,
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
  if (!(await exists(targetPath))) return;

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

  // If Fresh module is enabled, merge imports into deno.jsonc and delete import_map.json
  const denoConfigPath = join(options.targetDir, "deno.jsonc");
  if (options.enabledModules.includes("fresh") && await exists(denoConfigPath)) {
    try {
      const denoContent = await Deno.readTextFile(denoConfigPath);
      const denoConfig = parseJsonc(denoContent) as DenoConfig;

      // Merge imports into deno.jsonc
      denoConfig.imports = baseMap.imports;

      // Write merged config
      await Deno.writeTextFile(
        denoConfigPath,
        JSON.stringify(denoConfig, null, 2) + "\n",
      );

      // Delete import_map.json as it's no longer needed with Fresh
      await Deno.remove(targetPath);
    } catch (error) {
      console.error("Failed to merge imports into deno.jsonc:", error);
    }
  } else {
    // Write merged import map for non-Fresh projects
    await Deno.writeTextFile(
      targetPath,
      JSON.stringify(baseMap, null, 2) + "\n",
    );
    result.mergedFiles.push("import_map.json");
  }
}

