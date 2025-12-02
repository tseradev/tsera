/**
 * Configuration file merging utilities for template composition.
 *
 * This module handles intelligent merging of configuration files like
 * deno.jsonc when composing templates from multiple modules.
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
 * - deno.jsonc (merge tasks and imports)
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
  // Merge deno.jsonc tasks and imports
  await mergeDenoConfig(options, result, freshDenoConfig);

  // Merge module dependencies into deno.jsonc imports
  await mergeImportsIntoDenoConfig(options, result);

  // Delete import_map.json if it exists (migration cleanup)
  const importMapPath = join(options.targetDir, "import_map.json");
  if (await exists(importMapPath)) {
    try {
      await Deno.remove(importMapPath);
    } catch {
      // Ignore errors
    }
  }
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
    // Fresh needs npm dependencies (Preact/Vite). Use auto to ensure node_modules
    // is populated without requiring a manual deno install step.
    baseConfig.nodeModulesDir = "auto";

    // Merge Fresh tasks (adapted for TSera structure with app/front/)
    // IMPORTANT: Run Vite from app/front/ directory so it can correctly resolve Fresh's internal modules
    // Use vite version from MODULE_DEPENDENCIES to ensure consistency
    if (freshDenoConfig.tasks) {
      // Extract vite version from MODULE_DEPENDENCIES
      const viteCommand = MODULE_DEPENDENCIES.fresh.vite;

      baseConfig.tasks = {
        ...baseConfig.tasks,
        "dev:front": `cd app/front && deno run -A ${viteCommand}`,
        "build:front": `cd app/front && deno run -A ${viteCommand} build`,
        "start:front": "deno serve -A _fresh/server.js",
        "update:front": "deno run -A -r jsr:@fresh/update app/front",
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

    // Add exclude for _fresh directory (matching Fresh standard)
    const exclude = baseConfig.exclude as string[] | undefined;
    if (!exclude) {
      baseConfig.exclude = ["**/_fresh/*"];
    } else if (!exclude.includes("**/_fresh/*")) {
      exclude.push("**/_fresh/*");
      baseConfig.exclude = exclude;
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
 * Merges module dependencies into deno.jsonc imports.
 * Removes dependencies from disabled modules to keep imports clean.
 *
 * @param options - Composition options.
 * @param result - Composition result to update.
 */
async function mergeImportsIntoDenoConfig(
  options: ComposeOptions,
  _result: ComposedTemplate,
): Promise<void> {
  const denoConfigPath = join(options.targetDir, "deno.jsonc");
  if (!(await exists(denoConfigPath))) return;

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
    delete denoConfig.imports[depKey];
  }

  // Add module-specific dependencies for enabled modules
  for (const moduleName of options.enabledModules) {
    if (MODULE_DEPENDENCIES[moduleName]) {
      denoConfig.imports = { ...denoConfig.imports, ...MODULE_DEPENDENCIES[moduleName] };
    }
  }

  // Check each module for additional imports from their import_map.json files (legacy support)
  for (const moduleName of options.enabledModules) {
    const modulePath = join(options.modulesDir, moduleName, "import_map.json");
    if (await exists(modulePath)) {
      const moduleContent = await Deno.readTextFile(modulePath);
      const moduleMap = parseJsonc(moduleContent) as ImportMap;

      // Merge imports into deno.jsonc
      if (moduleMap.imports) {
        denoConfig.imports = { ...denoConfig.imports, ...moduleMap.imports };
      }
    }
  }

  // Sort imports for consistency
  const imports = denoConfig.imports;
  const sortedImports = Object.keys(imports)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = imports[key];
      return acc;
    }, {});

  denoConfig.imports = sortedImports;

  // Ensure importMap field is never set
  if (denoConfig.importMap) {
    delete denoConfig.importMap;
  }

  // Write merged config
  await Deno.writeTextFile(
    denoConfigPath,
    JSON.stringify(denoConfig, null, 2) + "\n",
  );
}
