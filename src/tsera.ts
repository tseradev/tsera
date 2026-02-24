/**
 * @module tsera
 * TSera - Configuration and environment utilities for TSera projects.
 *
 * Configuration and environment are loaded once at module import time.
 * Restart the process to reload.
 *
 * @example
 * ```typescript
 * import { TSera } from "@tsera/core";
 *
 * // Access config
 * const dialect = TSera.config.db.dialect;
 *
 * // Access typed environment variables from secrets manager
 * const dbUrl = TSera.env.DATABASE_URL;
 * ```
 */

import type { TseraConfig } from "./cli/definitions.ts";
import { DEFAULT_CONFIG, findConfigFile } from "./config-loader.ts";
import {
  bootstrapEnv,
  createEnvModule,
  detectEnvName,
  type EnvModule,
  type EnvSchema,
  type EnvValue,
} from "./core/secrets.ts";

// ============================================================================
// Config Loading (sync)
// ============================================================================

// Load config at module import time
findConfigFile(Deno.cwd());

// ============================================================================
// Environment Loading (async at module import time)
// ============================================================================

async function loadEnvModule(): Promise<EnvModule<EnvSchema>> {
  const envName = detectEnvName();
  try {
    const envValues = await bootstrapEnv(envName, "config/secrets");
    // Convert to EnvValue format
    const converted: Record<string, EnvValue> = {};
    for (const [key, value] of Object.entries(envValues)) {
      converted[key] = value;
    }
    return createEnvModule(converted, {} as EnvSchema);
  } catch {
    // Secrets module not configured, return empty module
    return createEnvModule({}, {} as EnvSchema);
  }
}

// Top-level await - loads env at module import time
const _envModule = await loadEnvModule();

// ============================================================================
// TSera API
// ============================================================================

/**
 * TSera - Configuration and environment utilities.
 *
 * Configuration and environment are loaded once at module import time.
 * Restart the process to reload.
 */
export const TSera = {
  /** Configuration loaded at module import time. */
  config: DEFAULT_CONFIG as TseraConfig,

  /** Environment variables from secrets manager (typed per env.config.ts). */
  env: _envModule,
};

export { DEFAULT_CONFIG };
export type { EnvModule } from "./core/secrets.ts";
