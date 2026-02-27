/**
 * @module mod
 * TSera public API - Main entry point for library usage.
 *
 * @example
 * ```typescript
 * import { TSera, defineEntity, z } from "@tsera/core";
 *
 * // Access runtime config and environment
 * const dialect = TSera.config.db.dialect;
 * const dbUrl = TSera.env.DATABASE_URL;
 *
 * // Define entities
 * const User = defineEntity({
 *   name: "User",
 *   fields: {
 *     id: { validator: z.uuid() },
 *     email: { validator: z.email() },
 *   },
 * });
 * ```
 */

// Runtime
export { DEFAULT_CONFIG, TSera } from "./tsera.ts";
export type { EnvModule } from "./tsera.ts";

// Config utilities
export { CONFIG_PATH, hasConfigFile } from "./config-loader.ts";

// Config types
export type {
  DbConfig,
  DeployConfig,
  DeployProvider,
  DeployTarget,
  ModulesConfig,
  PathsConfig,
  TseraConfig,
} from "./cli/definitions.ts";

// Core (entity, drizzle, secrets, etc.)
export * from "./core/index.ts";
