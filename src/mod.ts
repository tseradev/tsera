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
 * import { TSera } from "tsera";
 *
 * // Wait for auto-initialization
 * await TSera.ready;
 *
 * // Access configuration
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
 */

// Main facade
export { TSera } from "./tsera.ts";
export type { EnvModule } from "./tsera.ts";

// Configuration types
export type {
  TseraConfig,
  DbConfig,
  DeployConfig,
  DeployTarget,
  DeployProvider,
  ModulesConfig,
  PathsConfig,
  ResolvedTseraConfig,
} from "./cli/definitions.ts";

// Core entity system
export { defineEntity } from "./core/entity.ts";
export type {
  EntityConfig,
  EntityRuntime,
  FieldDef,
  FieldVisibility,
  FieldDbMetadata,
  RelationsConfig,
  ActionsConfig,
  OpenAPIConfig,
  DocsConfig,
} from "./core/entity.ts";

// Schema helpers
export {
  getEntitySchema,
  getEntityPublicSchema,
  getEntityInputSchemas,
} from "./core/schema.ts";

// Secrets management
export {
  defineEnvConfig,
  validateSecrets,
  parseEnvFile,
  getEnv,
  initializeSecrets,
  bootstrapEnv,
  isValidEnvName,
} from "./core/secrets.ts";
export type {
  EnvSchema,
  EnvVarDefinition,
  EnvVarType,
  EnvName,
  ValidationResult,
} from "./core/secrets.ts";

// OpenAPI generation
export { generateOpenAPIDocument } from "./core/openapi.ts";

// Drizzle/Database helpers
export { entityToDDL } from "./core/drizzle.ts";
