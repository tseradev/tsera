/**
 * @module tsera
 * TSera Facade - Synchronous API for TSera projects.
 *
 * This module provides a unified, junior-friendly API for accessing
 * TSera configuration and services. The facade is initialized
 * synchronously at module load time.
 *
 * ## Usage
 *
 * ```typescript
 * import { TSera, createTSera } from "@tsera/core";
 *
 * // TSera is immediately available (synchronous initialization)
 * const config = TSera.config;
 *
 * // Or create with explicit config
 * import myConfig from "./tsera.config.ts";
 * const myTSera = createTSera(myConfig);
 * ```
 *
 * ## Conditional Modules
 *
 * Modules are available based on configuration:
 * - If `modules.secrets = true`, `TSera.env` is available
 * - If `modules.secrets = false`, `TSera.env` is undefined
 */

import type { ResolvedTseraConfig, TseraConfig } from "./cli/definitions.ts";
import { createResolvedConfig, DEFAULT_CONFIG, loadConfigSync } from "./config-loader.ts";

/**
 * Type for the Env module interface.
 * Defined here to avoid circular dependencies.
 */
export interface EnvModule {
  /**
   * Gets an environment variable by key.
   * Returns undefined if the variable is not set.
   *
   * @param key - Environment variable name
   * @returns The value or undefined
   */
  get<K extends string>(key: K): string | undefined;

  /**
   * Gets an environment variable by key.
   * Throws if the variable is not set.
   *
   * @param key - Environment variable name
   * @returns The value (never undefined)
   * @throws Error if the variable is not set
   */
  require<K extends string>(key: K): string;

  /**
   * Checks if an environment variable is defined.
   *
   * @param key - Environment variable name
   * @returns True if the variable is set
   */
  has<K extends string>(key: K): boolean;
}

/**
 * Creates the Env module with property access support.
 *
 * This function creates a Proxy-based environment module that allows
 * both property access (TSera.env.DB_URL) and method access
 * (TSera.env.get("DB_URL")).
 *
 * @param envVars - Validated environment variables
 * @returns EnvModule with property and method access
 */
function createEnvModule(envVars: Record<string, string>): EnvModule {
  const module: EnvModule = {
    get<K extends string>(key: K): string | undefined {
      return envVars[key];
    },

    require<K extends string>(key: K): string {
      const value = envVars[key];
      if (value === undefined) {
        throw new Error(`Required environment variable "${key}" is not set.`);
      }
      return value;
    },

    has<K extends string>(key: K): boolean {
      return envVars[key] !== undefined;
    },
  };

  // Return a proxy to enable property access (TSera.env.DB_URL)
  return new Proxy(module, {
    get(target: EnvModule, prop: string | symbol): unknown {
      // If the property exists on the module itself, return it
      if (prop in target) {
        return (target as unknown as Record<string | symbol, unknown>)[prop];
      }

      // Otherwise, treat it as an environment variable key
      if (typeof prop === "string") {
        return envVars[prop];
      }

      return undefined;
    },

    has(target: EnvModule, prop: string | symbol): boolean {
      // Check if it's a module method
      if (prop in target) {
        return true;
      }

      // Check if it's an environment variable
      if (typeof prop === "string") {
        return prop in envVars;
      }

      return false;
    },

    ownKeys(): string[] {
      // Return all environment variable keys plus module methods
      return Object.keys(envVars).concat(["get", "require", "has"]);
    },

    getOwnPropertyDescriptor(
      _target: EnvModule,
      prop: string | symbol,
    ): PropertyDescriptor | undefined {
      if (typeof prop === "string") {
        const isMethod = ["get", "require", "has"].includes(prop);
        const isEnvVar = prop in envVars;

        if (isMethod || isEnvVar) {
          return {
            enumerable: true,
            configurable: true,
            value: isMethod ? (_target as unknown as Record<string, unknown>)[prop] : envVars[prop],
          };
        }
      }
      return undefined;
    },
  }) as EnvModule;
}

/**
 * Loads environment variables synchronously from Deno.env.
 *
 * This function reads environment variables directly from Deno.env
 * for the secrets module.
 *
 * @param config - TSera configuration
 * @returns Environment variables record
 */
function loadEnvVariablesSync(config: TseraConfig): Record<string, string> {
  // Check if secrets module is enabled
  if (!config.modules?.secrets) {
    return {};
  }

  // For synchronous initialization, we read from Deno.env directly
  // This is a simplified approach - full validation would require
  // the env.config.ts schema which needs async loading
  const envVars: Record<string, string> = {};

  // Common database URLs
  const dbUrl = Deno.env.get("DATABASE_URL");
  if (dbUrl) {
    envVars.DATABASE_URL = dbUrl;
  }

  // Copy all TSERA_ prefixed env vars
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.startsWith("TSERA_") || key === "PORT" || key === "HOST") {
      envVars[key] = value;
    }
  }

  return envVars;
}

/**
 * Internal state for the TSera facade.
 */
let _resolvedConfig: ResolvedTseraConfig;
let _envModule: EnvModule | undefined = undefined;

/**
 * Creates a TSera facade instance with explicit configuration.
 *
 * Use this function when you want to provide configuration explicitly
 * rather than relying on auto-discovery. This is the recommended
 * approach for production usage.
 *
 * @param config - The TSera configuration to use.
 * @param configPath - Optional path to the config file.
 * @returns TSera facade object.
 *
 * @example
 * ```typescript
 * import { createTSera } from "@tsera/core";
 * import myConfig from "./tsera.config.ts";
 *
 * const TSera = createTSera(myConfig);
 * console.log(TSera.config.db.dialect);
 *
 * // Access environment variables (if secrets module enabled)
 * const dbUrl = TSera.env?.require("DATABASE_URL");
 * ```
 */
export function createTSera(
  config: TseraConfig,
  configPath: string = "programmatic",
): TSeraFacade {
  const resolvedConfig = createResolvedConfig(config, configPath);
  const envVars = loadEnvVariablesSync(config);
  const envModule = (Object.keys(envVars).length > 0 || config.modules?.secrets)
    ? createEnvModule(envVars)
    : undefined;

  return {
    config: resolvedConfig.config,
    resolvedConfig,
    env: envModule,
  };
}

/**
 * TSera Facade interface.
 *
 * Defines the structure of the TSera facade object.
 */
export interface TSeraFacade {
  /** Resolved TSera configuration. */
  config: TseraConfig;

  /** Resolved configuration with absolute path to config file. */
  resolvedConfig: ResolvedTseraConfig;

  /** Environment module for accessing secrets (if enabled). */
  env?: EnvModule;
}

// Initialize default TSera facade synchronously
_resolvedConfig = loadConfigSync();
const _initialEnvVars = loadEnvVariablesSync(_resolvedConfig.config);
_envModule = (Object.keys(_initialEnvVars).length > 0 ||
    _resolvedConfig.config.modules?.secrets)
  ? createEnvModule(_initialEnvVars)
  : undefined;

/**
 * TSera Facade - Main entry point for TSera runtime API.
 *
 * This object provides a unified, type-safe interface to TSera
 * configuration and services. It is initialized synchronously at
 * module load time.
 *
 * For explicit configuration, use `createTSera()` instead.
 *
 * ## Example
 *
 * ```typescript
 * import { TSera } from "@tsera/core";
 *
 * // TSera is immediately available (no await needed)
 * console.log(TSera.config.db.dialect);
 *
 * // Access environment variables (if secrets module enabled)
 * const dbUrl = TSera.env?.require("DATABASE_URL");
 * ```
 */
export const TSera: TSeraFacade = {
  config: _resolvedConfig.config,
  resolvedConfig: _resolvedConfig,
  env: _envModule,
};

// Re-export DEFAULT_CONFIG for programmatic usage
export { DEFAULT_CONFIG };
