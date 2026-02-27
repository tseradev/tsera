/**
 * @module tsera
 * TSera runtime - Configuration and environment loaded at module import time.
 *
 * This module provides the main `TSera` object with `config` and `env` properties.
 * Both are initialized when the module is imported. Restart the process to reload.
 *
 * @example
 * ```typescript
 * import { TSera } from "@tsera/core";
 *
 * // Access configuration
 * const dialect = TSera.config.db.dialect;
 *
 * // Access typed environment variables
 * const dbUrl = TSera.env.DATABASE_URL;
 *
 * // Check if variable is defined
 * if (TSera.env.has("DEBUG")) {
 *   console.log("Debug mode enabled");
 * }
 * ```
 */

import type { TseraConfig } from "./cli/definitions.ts";
import { DEFAULT_CONFIG } from "./config-loader.ts";
import { bootstrapEnv, createEnvModule, type EnvModule, type EnvValue } from "./core/secrets.ts";

/** Loads environment module from config/secrets directory. */
async function loadEnvModule(): Promise<EnvModule<Record<string, EnvValue>>> {
  try {
    const envValues = await bootstrapEnv("config/secrets/env.config.ts", "config/secrets");
    return createEnvModule(envValues);
  } catch {
    return createEnvModule({}) as EnvModule<Record<string, EnvValue>>;
  }
}

const _envModule = await loadEnvModule();

/**
 * TSera runtime object providing access to configuration and environment.
 *
 * - `config`: Default configuration (use `resolveConfig()` for full loading)
 * - `env`: Typed environment variables from secrets manager
 */
export const TSera = {
  config: DEFAULT_CONFIG as TseraConfig,
  env: _envModule,
};

export { DEFAULT_CONFIG };
export type { EnvModule } from "./core/secrets.ts";
