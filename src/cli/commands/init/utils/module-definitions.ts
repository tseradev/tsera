/**
 * Module definitions and dependency management for TSera template composition.
 *
 * This module defines all available template modules, their dependencies,
 * and provides utilities to validate module configurations.
 *
 * @module
 */

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
 * Module definitions with their merge strategies.
 */
export const MODULE_DEFINITIONS: Record<string, TemplateModule> = {
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
  "ci-cd": {
    name: "ci-cd",
    mergeStrategy: "copy",
  },
  secrets: {
    name: "secrets",
    mergeStrategy: "copy",
  },
};

/**
 * Module-specific dependencies that should be added to import_map.json
 * when the module is enabled.
 */
export const MODULE_DEPENDENCIES: Record<string, Record<string, string>> = {
  hono: {
    "hono": "jsr:@hono/hono@^4.0.0",
  },
  fresh: {
    "fresh": "jsr:@fresh/core@^2.1.4",
    "fresh/": "jsr:@fresh/core@^2.1.4/",
    "preact": "npm:preact@^10.27.2",
    "preact/": "npm:preact@^10.27.2/",
    "@preact/signals": "npm:@preact/signals@^2.3.2",
    "@fresh/plugin-vite": "jsr:@fresh/plugin-vite@^1.0.7",
    "vite": "npm:vite@^7.1.3",
  },
};

/**
 * Validates that all module dependencies are satisfied.
 *
 * @param enabledModules - List of enabled module names.
 * @throws {Error} If dependencies are not satisfied.
 */
export function validateModuleDependencies(enabledModules: string[]): void {
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
 * Gets available module names.
 *
 * @returns Array of module names.
 */
export function getAvailableModules(): string[] {
  return Object.keys(MODULE_DEFINITIONS);
}

