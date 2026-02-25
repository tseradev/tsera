/**
 * @module config-loader
 * TSera configuration utilities for module load time.
 *
 * The TSera config file is always located at `config/tsera.config.ts`.
 * For async config loading with full validation, use `resolveConfig()` from
 * `cli/utils/resolve-config.ts`.
 *
 * @example
 * ```typescript
 * import { DEFAULT_CONFIG, hasConfigFile } from "@tsera/core";
 *
 * if (hasConfigFile()) {
 *   console.log("Config file found at config/tsera.config.ts");
 * }
 *
 * // Use default config as fallback
 * const config = DEFAULT_CONFIG;
 * ```
 */

import type { TseraConfig } from "./cli/definitions.ts";

/** Path to the TSera config file (relative to project root) */
export const CONFIG_PATH = "config/tsera.config.ts";

/**
 * Default TSera configuration for projects without a config file.
 *
 * Used when:
 * - No `config/tsera.config.ts` file exists
 * - Running tests outside a TSera project
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
 * Checks if the TSera config file exists.
 * @returns `true` if `config/tsera.config.ts` exists
 */
export function hasConfigFile(): boolean {
  try {
    return Deno.statSync(CONFIG_PATH).isFile;
  } catch {
    return false;
  }
}
