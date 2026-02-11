/**
 * @module defineEnvConfig
 * Environment variable schema definition helper for TSera.
 *
 * This module provides type-safe environment variable configuration
 * with compile-time validation and runtime type checking.
 */

/**
 * Valid environment variable types.
 */
export type EnvVarType = "string" | "number" | "boolean" | "url";

/**
 * Valid environment names.
 */
export type EnvName = "dev" | "staging" | "prod";

/**
 * Configuration for a single environment variable.
 */
export type EnvVarDefinition = {
  /** Variable type (REQUIRED) */
  type: EnvVarType;
  /** Required specification (REQUIRED) */
  required: boolean | EnvName[];
  /** Human-readable description (optional but recommended) */
  description?: string;
};

/**
 * Environment schema type.
 */
export type EnvSchema = Record<string, EnvVarDefinition>;

/**
 * Type-safe environment variable schema definition helper.
 *
 * This function provides VSCode autocomplete and strong typing for
 * environment variable schemas. It enforces required fields at compile time.
 *
 * @example
 * ```ts
 * import { defineEnvConfig } from "./defineEnvConfig.ts";
 *
 * export default defineEnvConfig({
 *   DATABASE_URL: {
 *     type: "url",
 *     required: true,
 *     description: "Database connection URL",
 *   },
 *   PORT: {
 *     type: "number",
 *     required: false,
 *     description: "API server port",
 *   },
 *   DEBUG: {
 *     type: "boolean",
 *     required: ["dev", "staging"],
 *   },
 * });
 * ```
 *
 * @param schema - Environment variable schema definition
 * @returns Readonly schema with enforced types
 */
export function defineEnvConfig<T extends EnvSchema>(
  schema: T,
): Readonly<T> {
  return Object.freeze(schema);
}
