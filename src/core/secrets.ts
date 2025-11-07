/**
 * Type-safe environment variable management for TSera projects.
 *
 * This module provides a schema-based approach to defining and validating
 * environment variables, ensuring all required configuration is present
 * before the application starts.
 *
 * @module
 */

import { SchemaError, z } from "./utils/zod.ts";

/**
 * Supported environment types.
 */
export type Environment = "dev" | "preprod" | "prod";

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
  /** Whether the variable is required (can be environment-specific). */
  required: boolean | Record<Environment, boolean>;
  /** Default value if not provided. */
  default?: T extends "string" ? string
  : T extends "number" ? number
  : T extends "boolean" ? boolean
  : never;
  /** Human-readable description. */
  description?: string;
  /** Environments where this variable is applicable. */
  environments?: Environment[];
  /** Validation function for custom checks. */
  validate?: (value: unknown) => boolean;
}

/**
 * Schema definition mapping variable names to their configurations.
 */
export type EnvSchema<
  T extends Record<string, EnvVarDefinition> = Record<string, EnvVarDefinition>,
> = {
    [K in keyof T]: T[K];
  };

/**
 * Result of environment validation.
 */
export interface ValidationResult {
  /** Whether validation passed. */
  valid: boolean;
  /** List of validation errors. */
  errors: string[];
  /** Parsed and validated environment variables. */
  values: Record<string, unknown>;
}

/**
 * Typed environment accessor based on schema.
 */
export type TypedEnv<T extends Record<string, EnvVarDefinition>> = {
  [K in keyof T]: T[K]["type"] extends "string" ? string
  : T[K]["type"] extends "number" ? number
  : T[K]["type"] extends "boolean" ? boolean
  : never;
};

/**
 * Defines a type-safe environment variable schema.
 *
 * @param schema - Environment variable definitions.
 * @returns Validated schema.
 *
 * @example
 * ```typescript
 * const envSchema = defineEnvSchema({
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
  schema: T,
): EnvSchema<T> {
  return schema;
}

/**
 * Validates environment variables against a schema for a specific environment.
 *
 * @param schema - Environment schema to validate against.
 * @param environment - Target environment (dev, preprod, prod).
 * @returns Validation result with any errors and parsed values.
 *
 * @example
 * ```typescript
 * const result = validateEnv(envSchema, "prod");
 * if (!result.valid) {
 *   console.error("Environment validation failed:");
 *   result.errors.forEach(err => console.error(`  - ${err}`));
 *   Deno.exit(1);
 * }
 * ```
 */
export function validateEnv<T extends Record<string, EnvVarDefinition>>(
  schema: EnvSchema<T>,
  environment: Environment,
): ValidationResult {
  const errors: string[] = [];
  const values: Record<string, unknown> = {};

  for (const [key, definition] of Object.entries(schema)) {
    // Check if variable is applicable to this environment
    if (definition.environments && !definition.environments.includes(environment)) {
      continue;
    }

    const rawValue = Deno.env.get(key);

    // Determine if variable is required for this environment
    const isRequired = typeof definition.required === "boolean"
      ? definition.required
      : definition.required[environment] ?? false;

    // Check for missing required variables
    if (isRequired && !rawValue && definition.default === undefined) {
      errors.push(`Missing required environment variable: ${key}`);
      continue;
    }

    // Use default if no value provided
    const valueToUse = rawValue ?? String(definition.default);

    // Parse and validate the value
    try {
      const parsedValue = parseEnvValue(valueToUse, definition.type);

      // Run custom validation if provided
      if (definition.validate && !definition.validate(parsedValue)) {
        errors.push(`Validation failed for ${key}: custom validator rejected value`);
        continue;
      }

      values[key] = parsedValue;
    } catch (error: unknown) {
      // Extract detailed error message from SchemaError or use generic message
      let errorMessage =
        `Invalid value for ${key}: expected ${definition.type}, got "${valueToUse}"`;

      if (error instanceof SchemaError) {
        errorMessage = `Invalid value for ${key}: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = `Invalid value for ${key}: ${error.message}`;
      }

      errors.push(errorMessage);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    values,
  };
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
 * Parses a raw environment variable value to its expected type using Zod validation.
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
 * Creates a type-safe environment accessor from a validated schema.
 *
 * @param schema - Environment schema.
 * @param environment - Target environment.
 * @returns Type-safe environment accessor.
 * @throws {Error} If validation fails.
 *
 * @example
 * ```typescript
 * const env = createEnv(envSchema, "prod");
 * const port = env.PORT; // Type: number
 * const dbUrl = env.DATABASE_URL; // Type: string
 * ```
 */
export function createEnv<T extends Record<string, EnvVarDefinition>>(
  schema: EnvSchema<T>,
  environment: Environment,
): TypedEnv<T> {
  const result = validateEnv(schema, environment);

  if (!result.valid) {
    throw new Error(
      `Environment validation failed:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return result.values as TypedEnv<T>;
}

/**
 * Gets a single environment variable with type checking.
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
      // Type assertion is safe here because defaultValue matches the expected return type
      return defaultValue as T extends "string" ? string
        : T extends "number" ? number
        : T extends "boolean" ? boolean
        : never;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }

  // Type assertion is safe here because parseEnvValue returns the correct type based on T
  return parseEnvValue(rawValue, type) as T extends "string" ? string
    : T extends "number" ? number
    : T extends "boolean" ? boolean
    : never;
}
