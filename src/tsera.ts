/**
 * @module tsera
 * TSera Runtime - API for TSera projects.
 *
 * ## Usage
 *
 * ```typescript
 * import { TSera, createTSera } from "@tsera/core";
 *
 * // TSera is immediately available
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
import { createEnvModule, type EnvModule as CoreEnvModule, type EnvSchema, type EnvValue } from "./core/secrets.ts";

export type { EnvModule } from "./core/secrets.ts";

function loadEnvVariablesSync(config: TseraConfig): Record<string, EnvValue> {
  if (!config.modules?.secrets) {
    return {};
  }

  const envVars: Record<string, EnvValue> = {};

  const dbUrl = Deno.env.get("DATABASE_URL");
  if (dbUrl) {
    envVars.DATABASE_URL = dbUrl;
  }

  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.startsWith("TSERA_") || key === "PORT" || key === "HOST") {
      envVars[key] = value;
    }
  }

  return envVars;
}

let _resolvedConfig: ResolvedTseraConfig;
let _envModule: CoreEnvModule | undefined = undefined;

export type TSeraRuntime = {
  config: TseraConfig;
  resolvedConfig: ResolvedTseraConfig;
  env?: CoreEnvModule;
};

export function createTSera(
  config: TseraConfig,
  configPath: string = "programmatic",
): TSeraRuntime {
  const resolvedConfig = createResolvedConfig(config, configPath);
  const envVars = loadEnvVariablesSync(config);
  const emptySchema: EnvSchema = {};

  const envModule = (Object.keys(envVars).length > 0 || config.modules?.secrets)
    ? createEnvModule(envVars, emptySchema)
    : undefined;

  return {
    config: resolvedConfig.config,
    resolvedConfig,
    env: envModule,
  };
}

// Initialize default TSera runtime
_resolvedConfig = loadConfigSync();
const _initialEnvVars = loadEnvVariablesSync(_resolvedConfig.config);
const _emptySchema: EnvSchema = {};

_envModule = (Object.keys(_initialEnvVars).length > 0 ||
    _resolvedConfig.config.modules?.secrets)
  ? createEnvModule(_initialEnvVars, _emptySchema)
  : undefined;

export const TSera: TSeraRuntime = {
  config: _resolvedConfig.config,
  resolvedConfig: _resolvedConfig,
  env: _envModule,
};

export { DEFAULT_CONFIG };
