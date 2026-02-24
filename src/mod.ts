/**
 * @module mod
 * TSera Public API - Main entry point for library usage.
 *
 * Configuration and environment are loaded once at module import time.
 * Restart the process to reload.
 *
 * @example
 * ```typescript
 * import { TSera } from "@tsera/core";
 *
 * // Access config (loaded once at import time)
 * const dialect = TSera.config.db.dialect;
 *
 * // Access typed environment variables from secrets manager
 * const dbUrl = TSera.env.DATABASE_URL;
 * ```
 */

// Main runtime
export { DEFAULT_CONFIG, TSera } from "./tsera.ts";
export type { EnvModule } from "./tsera.ts";

// Config loader
export {
  createResolvedConfig,
  findConfigFile,
  loadConfigSync,
} from "./config-loader.ts";
export type { LoadConfigResult } from "./config-loader.ts";

// Configuration types
export type {
  DbConfig,
  DeployConfig,
  DeployProvider,
  DeployTarget,
  ModulesConfig,
  PathsConfig,
  ResolvedTseraConfig,
  TseraConfig,
} from "./cli/definitions.ts";

// Core - re-export everything from core/index.ts
export * from "./core/index.ts";
