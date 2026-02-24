/**
 * @module config-loader
 * Synchronous configuration loader for TSera.
 *
 * This module provides utilities for loading TSera configuration
 * synchronously at module load time.
 */

import type { ResolvedTseraConfig, TseraConfig } from "./cli/definitions.ts";

/**
 * Default configuration used when no config file is found.
 *
 * This provides a minimal working configuration for cases where
 * TSera is used without a tsera.config.ts file (e.g., in tests
 * or when configuration is provided programmatically).
 */
export const DEFAULT_CONFIG: TseraConfig = {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: {
    entities: ["core/entities"],
  },
  db: {
    dialect: "sqlite",
    file: ".tsera/db.sqlite",
  },
  deploy: {
    target: "deno_deploy",
    entry: "app/back/main.ts",
  },
  modules: {
    hono: true,
    lume: false,
    docker: false,
    ci: false,
    secrets: false,
  },
};

/**
 * Result of config loading with optional warning.
 *
 * Used when config file exists but cannot be loaded synchronously.
 */
export type LoadConfigResult = ResolvedTseraConfig & {
  /** Warning message if config file was found but not loaded */
  warning?: string;
};

/**
 * Attempts to find the project root by looking for tsera.config.ts.
 *
 * @param startDir - Directory to start searching from.
 * @returns Path to config file or null if not found.
 */
export function findConfigFile(startDir: string): string | null {
  let currentDir = startDir;

  // Search up the directory tree
  for (let i = 0; i < 10; i++) { // Limit depth to prevent infinite loops
    const configPath = `${currentDir}/tsera.config.ts`;
    try {
      const stat = Deno.statSync(configPath);
      if (stat.isFile) {
        return configPath;
      }
    } catch {
      // File doesn't exist, continue searching
    }

    // Move up one directory
    const parentDir = new URL("..", `file://${currentDir}/`).pathname;
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Synchronously loads TSera configuration.
 *
 * This function attempts to load configuration from:
 * 1. The provided config path (if any)
 * 2. tsera.config.ts in the current directory or parent directories
 * 3. Falls back to default configuration if not found
 *
 * @param configPath - Optional path to config file.
 * @returns Resolved configuration with optional warning.
 */
export function loadConfigSync(configPath?: string): LoadConfigResult {
  const foundPath = configPath ?? findConfigFile(Deno.cwd());

  if (foundPath) {
    return {
      configPath: foundPath,
      config: DEFAULT_CONFIG,
      warning: `Config file found at ${foundPath} but synchronous loading is not supported. Using default config.`,
    };
  }

  return {
    configPath: "default",
    config: DEFAULT_CONFIG,
  };
}

/**
 * Creates a TSera configuration resolver from a loaded config.
 *
 * Use this function when you want to provide configuration explicitly
 * rather than relying on auto-discovery.
 *
 * @param config - The TSera configuration to use.
 * @param configPath - Optional path to the config file.
 * @returns Resolved configuration.
 *
 * @example
 * ```typescript
 * import { createResolvedConfig } from "@tsera/core";
 * import myConfig from "./tsera.config.ts";
 *
 * const resolved = createResolvedConfig(myConfig);
 * console.log(resolved.config.db.dialect);
 * ```
 */
export function createResolvedConfig(
  config: TseraConfig,
  configPath: string = "programmatic",
): ResolvedTseraConfig {
  return {
    configPath,
    config,
  };
}
