/**
 * @module mod
 * TSera Public API - Main entry point for library usage.
 *
 * This module exports the public API of TSera for use in
 * generated projects and external applications.
 *
 * ## Usage
 *
 * ```typescript
 * import { TSera } from "@tsera/core";
 *
 * // TSera is immediately available (synchronous initialization)
 * const config = TSera.config;
 *
 * // Access environment variables (if secrets module enabled)
 * const dbUrl = TSera.env?.require("DATABASE_URL");
 * ```
 *
 * ## Exports
 *
 * - `TSera` - Main facade object for accessing TSera services
 * - `TseraConfig` - Configuration type for TSera projects
 * - `EnvModule` - Interface for the environment module
 * - Core entity system (`defineEntity`, etc.)
 * - Schema helpers (`getEntitySchema`, etc.)
 * - Secrets management (`defineEnvConfig`, etc.)
 * - OpenAPI generation (`generateOpenAPIDocument`)
 * - Drizzle/Database helpers (`entityToDDL`, `createDrizzleConfig`, etc.)
 */

// Main facade
export { createTSera, DEFAULT_CONFIG, TSera } from "./tsera.ts";
export type { EnvModule, TSeraFacade } from "./tsera.ts";

// Config loader
export { createResolvedConfig, loadConfigSync } from "./config-loader.ts";

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

// Core - réexporter tout depuis core/index.ts
// Entity system
export {
  type ActionsConfig,
  defineEntity,
  type DocsConfig,
  type EntityConfig,
  type EntityRuntime,
  type FieldDbMetadata,
  type FieldDef,
  type FieldVisibility,
  filterPublicFields,
  filterStoredFields,
  maskSecretFields,
  type OpenAPIConfig,
  type RelationsConfig,
} from "./core/entity.ts";

// Schema helpers
export { getEntityInputSchemas, getEntityPublicSchema, getEntitySchema } from "./core/schema.ts";

// Secrets management
export {
  bootstrapEnv,
  defineEnvConfig,
  getEnv,
  initializeSecrets,
  isValidEnvName,
  parseEnvFile,
  type TseraAPI,
  validateSecrets,
  validateType,
} from "./core/secrets.ts";
export type {
  EnvName,
  EnvSchema,
  EnvVarDefinition,
  EnvVarType,
  ValidationResult,
} from "./core/secrets.ts";

// OpenAPI generation
export { generateOpenAPIDocument, type OpenAPIDocumentOptions } from "./core/openapi.ts";

// Drizzle/Database helpers
export { type Dialect, entityToDDL } from "./core/drizzle.ts";
export {
  createDrizzleConfig,
  createDrizzleConfigFromTsera,
  type CreateDrizzleConfigOptions,
  type DatabaseCredentials,
  type DatabaseDialect,
  type DrizzleConfig,
  type DrizzleMysqlConfig,
  type DrizzlePostgresConfig,
  type DrizzleSqliteConfig,
  getDatabaseCredentials,
  resolveDatabaseProvider,
  resolveDatabaseUrl,
  type ResolveDatabaseUrlOptions,
  validateDatabaseConfig,
} from "./core/drizzle-config.ts";
