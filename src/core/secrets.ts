/**
 * Type-safe environment variable management for TSera projects.
 *
 * This module provides a schema-based approach to defining and validating
 * environment variables from .env files, ensuring all required configuration
 * is present before the application starts.
 *
 * @module
 */

import { SchemaError, z } from "./utils/zod.ts";

/**
 * Primitive types supported for environment variables.
 */
export type EnvVarType = "string" | "number" | "boolean";

/**
 * Configuration for a single environment variable.
 */
export interface EnvVarDefinition<T extends EnvVarType = EnvVarType> {
  /** Type of the environment variable. */
  type: T;
  /** Whether the variable is required. */
  required: boolean;
  /** Default value if not provided. */
  default?: T extends "string" ? string
    : T extends "number" ? number
    : T extends "boolean" ? boolean
    : never;
  /** Human-readable description. */
  description?: string;
  /** Validation function for custom checks. */
  validate?: (value: unknown) => boolean;
}

/**
 * Schema definition with variables and available environments.
 */
export interface EnvSchema<
  T extends Record<string, EnvVarDefinition> = Record<string, EnvVarDefinition>,
> {
  vars: T;
  environments: readonly string[];
}

/**
 * TSera global API for accessing environment variables.
 */
export interface TseraAPI {
  /**
   * Get an environment variable value.
   * @param key - The variable name.
   * @returns The typed value.
   */
  env(key: string): string | number | boolean | undefined;

  /**
   * The currently active environment (dev, preprod, prod, etc.).
   */
  currentEnvironment: string;
}

/**
 * Global type declaration for tsera API.
 */
declare global {
  var tsera: TseraAPI;
}

/**
 * Internal storage for validated environment variables.
 */
const envStore: Record<string, unknown> = {};
let currentEnv = "dev";

/**
 * Defines a type-safe environment variable schema.
 *
 * @param vars - Environment variable definitions.
 * @param environments - List of available environments (defaults to dev, preprod, prod).
 * @returns Schema object.
 *
 * @example
 * ```typescript
 * export const envSchema = defineEnvSchema({
 *   DATABASE_URL: {
 *     type: "string",
 *     required: true,
 *     description: "PostgreSQL connection string",
 *   },
 *   PORT: {
 *     type: "number",
 *     required: false,
 *     default: 8000,
 *   },
 * });
 * ```
 */
export function defineEnvSchema<T extends Record<string, EnvVarDefinition>>(
  vars: T,
  environments: readonly string[] = ["dev", "preprod", "prod"],
): EnvSchema<T> {
  return { vars, environments };
}

/**
 * Parses a .env file content into a key-value object.
 *
 * @param content - The .env file content.
 * @returns Parsed environment variables.
 *
 * @example
 * ```typescript
 * const content = "PORT=8000\nDATABASE_URL=postgres://localhost";
 * const vars = parseEnvFile(content);
 * // { PORT: "8000", DATABASE_URL: "postgres://localhost" }
 * ```
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=value format
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validates and parses a string value as a number.
 *
 * @param val - String value to parse.
 * @returns Parsed number.
 * @throws {SchemaError} If parsing fails.
 */
function parseNumber(val: string): number {
  const num = Number(val);
  if (isNaN(num)) {
    throw new SchemaError([{
      code: "custom",
      path: [],
      message: `Cannot parse "${val}" as number`,
    }]);
  }
  return num;
}

/**
 * Validates and parses a string value as a boolean.
 *
 * @param val - String value to parse.
 * @returns Parsed boolean.
 * @throws {SchemaError} If parsing fails.
 */
function parseBoolean(val: string): boolean {
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  throw new SchemaError([{
    code: "custom",
    path: [],
    message: `Cannot parse "${val}" as boolean (expected "true", "false", "1", or "0")`,
  }]);
}

/**
 * Parses a raw environment variable value to its expected type.
 *
 * @param value - Raw string value from environment.
 * @param type - Expected type.
 * @returns Parsed value.
 * @throws {SchemaError} If parsing or validation fails.
 */
function parseEnvValue(value: string | undefined, type: EnvVarType): unknown {
  if (value === undefined) {
    return undefined;
  }

  // Use Zod string schema as base, then apply type-specific parsing
  const stringSchema = z.string();
  const validatedString = stringSchema.parse(value);

  switch (type) {
    case "string":
      return validatedString;
    case "number":
      return parseNumber(validatedString);
    case "boolean":
      return parseBoolean(validatedString);
    default: {
      const exhaustiveCheck: never = type;
      throw new SchemaError([{
        code: "custom",
        path: [],
        message: `Unsupported type: ${exhaustiveCheck}`,
      }]);
    }
  }
}

/**
 * Initializes the secrets system by loading and validating environment variables.
 *
 * @param schema - Environment schema to validate against.
 * @param options - Initialization options.
 * @returns Promise that resolves when initialization is complete.
 * @throws {Error} If validation fails or environment is unknown.
 *
 * @example
 * ```typescript
 * import { initializeSecrets } from "tsera/core/secrets";
 * import { envSchema } from "./env.config.ts";
 *
 * await initializeSecrets(envSchema, {
 *   secretsDir: "./secrets"
 * });
 *
 * // Now use globally
 * const dbUrl = tsera.env("DATABASE_URL");
 * ```
 */
export async function initializeSecrets<T extends Record<string, EnvVarDefinition>>(
  schema: EnvSchema<T>,
  options?: {
    secretsDir?: string;
    environment?: string;
    useStore?: boolean; // default: true
    kvPath?: string; // default: ".tsera/kv"
  },
): Promise<void> {
  const secretsDir = options?.secretsDir || "./secrets";

  // Determine current environment from system variable or option
  const environment = options?.environment || Deno.env.get("TSERA_ENV") || "dev";

  // Validate that the environment exists in schema
  if (!schema.environments.includes(environment)) {
    throw new Error(
      `[TSera Secrets] Error: Unknown environment "${environment}"\n` +
        `Available: ${schema.environments.join(", ")}\n` +
        `Set TSERA_ENV to one of these values.`,
    );
  }

  // Construct path to the .env file for this environment
  const envFilePath = `${secretsDir}/.env.${environment}`.replace(/\\/g, "/");

  // Read and parse the .env file
  let envFileContent: string;
  try {
    envFileContent = await Deno.readTextFile(envFilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `[TSera Secrets] Error: Environment file not found: ${envFilePath}\n` +
          `Create this file with required variables for "${environment}" environment.`,
      );
    }
    throw error;
  }

  const parsedEnv = parseEnvFile(envFileContent);
  const errors: string[] = [];
  const values: Record<string, unknown> = {};

  // Validate each variable in the schema
  for (const [key, definition] of Object.entries(schema.vars)) {
    const rawValue = parsedEnv[key];

    // Check for missing required variables
    if (definition.required && !rawValue && definition.default === undefined) {
      errors.push(`Missing required variable: ${key}`);
      continue;
    }

    // Use default if no value provided
    const valueToUse = rawValue ??
      (definition.default !== undefined ? String(definition.default) : undefined);

    if (valueToUse === undefined) {
      // Optional variable not provided and no default
      continue;
    }

    // Parse and validate the value
    try {
      const parsedValue = parseEnvValue(valueToUse, definition.type);

      // Run custom validation if provided
      if (definition.validate && !definition.validate(parsedValue)) {
        errors.push(`${key}: custom validator rejected value`);
        continue;
      }

      values[key] = parsedValue;
    } catch (error: unknown) {
      let errorMessage = `${key}: expected ${definition.type}, got "${valueToUse}"`;

      if (error instanceof SchemaError) {
        errorMessage = `${key}: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = `${key}: ${error.message}`;
      }

      errors.push(errorMessage);
    }
  }

  // If there are validation errors, throw
  if (errors.length > 0) {
    throw new Error(
      `[TSera Secrets] Validation failed for environment "${environment}":\n` +
        errors.map((e) => `  - ${e}`).join("\n") + "\n" +
        `Check ${envFilePath}`,
    );
  }

  // Store validated values in memory
  Object.assign(envStore, values);
  currentEnv = environment;

  // Optionally persist to KV store
  const useStore = options?.useStore !== false; // Default: true
  if (useStore) {
    try {
      const { createSecretStore } = await import("./secrets/store.ts");
      const kvPath = options?.kvPath || ".tsera/kv";
      const store = await createSecretStore({ kvPath });

      // Persist validated values to KV
      for (const [key, value] of Object.entries(values)) {
        await store.set(environment, key, value);
      }

      store.close();
    } catch (error) {
      // If KV store fails, log a warning but don't fail initialization
      console.warn(
        `\x1b[33m[TSera Secrets]\x1b[0m Failed to persist to KV store: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Expose global API (always reads from memory, not KV)
  globalThis.tsera = {
    env: (key: string) => envStore[key] as string | number | boolean | undefined,
    currentEnvironment: currentEnv,
  };
}

/**
 * Gets a single environment variable with type checking (legacy API).
 * Prefer using `tsera.env()` after `initializeSecrets()`.
 *
 * @param key - Environment variable name.
 * @param type - Expected type.
 * @param defaultValue - Optional default value.
 * @returns Parsed environment variable value.
 *
 * @example
 * ```typescript
 * const port = getEnv("PORT", "number", 8000);
 * const debug = getEnv("DEBUG", "boolean", false);
 * ```
 */
export function getEnv<T extends EnvVarType>(
  key: string,
  type: T,
  defaultValue?: T extends "string" ? string
    : T extends "number" ? number
    : T extends "boolean" ? boolean
    : never,
): T extends "string" ? string
  : T extends "number" ? number
  : T extends "boolean" ? boolean
  : never {
  const rawValue = Deno.env.get(key);

  if (rawValue === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue as T extends "string" ? string
        : T extends "number" ? number
        : T extends "boolean" ? boolean
        : never;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return parseEnvValue(rawValue, type) as T extends "string" ? string
    : T extends "number" ? number
    : T extends "boolean" ? boolean
    : never;
}
