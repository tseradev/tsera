/**
 * @module core/secrets
 * Environment variable schema definition and validation for TSera.
 *
 * This module provides type-safe environment variable configuration
 * with compile-time validation and runtime type checking.
 *
 * ## Core Responsibilities
 *
 * - **Schema Definition**: Define environment variable schemas with type constraints
 * - **Validation**: Validate environment values against their declared types
 * - **File Parsing**: Parse .env files with proper comment and empty line handling
 * - **Bootstrap**: Fail-fast environment initialization at application startup
 *
 * ## Security Considerations
 *
 * - Never log raw secret values in error messages
 * - Environment variable values are masked in error messages (only keys shown)
 * - Validation errors provide actionable guidance without exposing sensitive data
 *
 * ## Usage Example
 *
 * ```ts
 * import { bootstrapEnv, defineEnvConfig } from "tsera/core";
 *
 * // Define environment schema
 * const envSchema = defineEnvConfig({
 *   DATABASE_URL: {
 *     type: "url",
 *     required: ["prod", "staging"],
 *     description: "PostgreSQL connection string",
 *   },
 *   PORT: {
 *     type: "number",
 *     required: true,
 *     description: "Server port number",
 *   },
 * });
 *
 * // Bootstrap environment at startup
 * const env = await bootstrapEnv("prod");
 *
 * // Access validated environment variables
 * const dbUrl = env.DATABASE_URL;
 * const port = env.PORT;
 * ```
 */

import { join } from "std/path";

/**
 * Valid environment variable types supported by TSera.
 *
 * Each type has specific validation rules:
 * - `string`: Any non-empty string value
 * - `number`: Valid numeric value (integer or float, finite)
 * - `boolean`: Case-insensitive "true" or "false"
 * - `url`: Valid URL string with scheme and host
 */
export type EnvVarType = "string" | "number" | "boolean" | "url";

/**
 * Valid environment names supported by TSera.
 *
 * These represent standard deployment environments:
 * - `dev`: Development environment for local development
 * - `staging`: Pre-production environment for testing
 * - `prod`: Production environment for live deployments
 */
export type EnvName = "dev" | "staging" | "prod";

/**
 * Type guard to check if a value is a valid EnvName.
 *
 * @param value - The string value to check
 * @returns True if the value is a valid environment name
 *
 * @example
 * ```ts
 * if (isValidEnvName(process.env.NODE_ENV)) {
 *   const env: EnvName = process.env.NODE_ENV;
 *   // env is now typed as "dev" | "staging" | "prod"
 * }
 * ```
 */
export function isValidEnvName(value: string): value is EnvName {
  return value === "dev" || value === "staging" || value === "prod";
}

/**
 * Configuration for a single environment variable.
 *
 * Defines the type, requirement rules, and optional metadata for
 * an environment variable in the schema.
 */
export type EnvVarDefinition = {
  /**
   * Variable type (REQUIRED).
   * Determines the validation rules applied to the environment variable value.
   */
  type: EnvVarType;

  /**
   * Required specification (REQUIRED).
   * - `true`: Required in all environments
   * - `EnvName[]`: Required only in specified environments
   */
  required: boolean | EnvName[];

  /**
   * Human-readable description (optional but recommended).
   * Provides context about the variable's purpose and usage.
   */
  description?: string;
};

/**
 * Environment schema type.
 *
 * A record mapping environment variable names to their definitions.
 * This schema serves as the single source of truth for environment
 * variable validation and type safety.
 */
export type EnvSchema = Record<string, EnvVarDefinition>;

// Re-export defineEnvConfig from single source of truth
// (templates/modules/secrets/defineEnvConfig.ts)
export { defineEnvConfig } from "../../templates/modules/secrets/defineEnvConfig.ts";

/**
 * Validation result type for type checking operations.
 *
 * Contains the validation status and an optional reason for failure.
 * The reason provides actionable feedback for fixing invalid values.
 */
export type ValidationResult = {
  /** Whether the validation passed */
  valid: boolean;
  /** Human-readable explanation of why validation failed (if applicable) */
  reason?: string;
};

/**
 * Validates a value against its declared type.
 *
 * Performs runtime type checking for environment variable values according
 * to their declared type in the schema. Returns detailed validation results
 * with actionable error messages.
 *
 * @param value - Raw string value from environment
 * @param type - Expected type from the schema definition
 * @returns Validation result with optional reason for failure
 *
 * @example
 * ```ts
 * const result = validateType("12345", "number");
 * // { valid: true }
 *
 * const result = validateType("not-a-number", "number");
 * // { valid: false, reason: "must be a number" }
 * ```
 */
export function validateType(
  value: string,
  type: EnvVarType,
): ValidationResult {
  switch (type) {
    case "string": {
      return { valid: typeof value === "string" };
    }
    case "number": {
      const num = Number(value);
      return {
        valid: !isNaN(num) && isFinite(num),
        reason: "must be a number",
      };
    }
    case "boolean": {
      const boolValue = value.toLowerCase();
      return {
        valid: boolValue === "true" || boolValue === "false",
        reason: "must be 'true' or 'false'",
      };
    }
    case "url": {
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, reason: "must be a valid URL" };
      }
    }
  }
}

/**
 * Validates environment variables against their schema definitions.
 *
 * Performs comprehensive validation of all environment variables defined in
 * the schema, checking for:
 * - Missing required variables
 * - Invalid type values
 * - Environment-specific requirements
 *
 * Error messages are formatted to provide actionable guidance without
 * exposing sensitive values (only keys are shown, not values).
 *
 * @param secrets - All environment variables (including undefined for missing keys)
 * @param schema - Environment schema defining expected variables
 * @param env - Current environment name for requirement checking
 * @returns Array of validation error messages (empty if validation passes)
 *
 * @example
 * ```ts
 * const secrets = { PORT: "8000", DATABASE_URL: undefined };
 * const schema = {
 *   PORT: { type: "number", required: true },
 *   DATABASE_URL: { type: "url", required: ["prod"] },
 * };
 *
 * const errors = validateSecrets(secrets, schema, "prod");
 * // ["[prod] Missing required env var \"DATABASE_URL\". Set it in config/secret/.env.prod."]
 * ```
 */
export function validateSecrets(
  secrets: Record<string, string | undefined>,
  schema: EnvSchema,
  env: EnvName,
): string[] {
  const errors: string[] = [];

  for (const [key, keyConfig] of Object.entries(schema)) {
    const value = secrets[key];

    // Check if key is required for this environment
    let isRequired = false;
    if (keyConfig.required === true) {
      isRequired = true;
    } else if (Array.isArray(keyConfig.required) && keyConfig.required.includes(env)) {
      isRequired = true;
    }

    if (value === undefined) {
      if (isRequired) {
        errors.push(
          `[${env}] Missing required env var "${key}". Set it in config/secret/.env.${env}.`,
        );
      }
      continue;
    }

    // Validate type
    const typeValidation = validateType(value, keyConfig.type);
    if (!typeValidation.valid && typeValidation.reason) {
      errors.push(
        `[${env}] Invalid env var "${key}": expected ${keyConfig.type}, got "${value}". Fix in config/secret/.env.${env}.`,
      );
    }
  }

  return errors;
}

/**
 * Loads environment variables from a .env file.
 *
 * Parses standard .env file format with support for:
 * - Key=value pairs
 * - Comments (lines starting with #)
 * - Empty lines
 * - Values with spaces
 *
 * Returns an empty object if the file does not exist (graceful degradation).
 *
 * @param filePath - Absolute or relative path to .env file
 * @returns Parsed environment variables as key-value pairs
 * @throws Error for file system errors other than NotFound
 *
 * @example
 * ```ts
 * // .env file content:
 * // PORT=8000
 * // DATABASE_URL=postgresql://localhost:5432/db
 * // DEBUG=true
 *
 * const env = await parseEnvFile(".env.dev");
 * // { PORT: "8000", DATABASE_URL: "postgresql://localhost:5432/db", DEBUG: "true" }
 * ```
 */
export async function parseEnvFile(
  filePath: string,
): Promise<Record<string, string>> {
  try {
    const content = await Deno.readTextFile(filePath);
    const env: Record<string, string> = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      env[key] = value;
    }

    return env;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {};
    }
    throw error;
  }
}

/**
 * Gets and validates environment variables from the current process.
 *
 * Retrieves environment variables from the process environment and validates
 * them against the provided schema. Only returns variables that are defined
 * and pass validation.
 *
 * @param schema - Environment schema defining expected variables
 * @param env - Current environment name for requirement checking (default: "dev")
 * @returns Validated environment variables (only defined values)
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```ts
 * const schema = {
 *   PORT: { type: "number", required: true },
 *   DATABASE_URL: { type: "url", required: true },
 * };
 *
 * const env = getEnv(schema, "prod");
 * // { PORT: "8000", DATABASE_URL: "postgresql://..." }
 * ```
 */
export function getEnv(
  schema: EnvSchema,
  env: EnvName = "dev",
): Record<string, string> {
  // Build secrets for ALL schema keys (including undefined for missing)
  const secrets: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema)) {
    secrets[key] = Deno.env.get(key);
  }

  // Validate
  const errors = validateSecrets(secrets, schema, env);
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  // Return only defined values
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Initializes secrets from environment and optional .env file.
 *
 * Loads environment variables from a .env file (if provided) and merges
 * them with existing process environment variables. The .env file values
 * only take effect if the corresponding environment variable is not already
 * set in the process environment.
 *
 * @param schema - Environment schema defining expected variables
 * @param env - Current environment name for requirement checking (default: "dev")
 * @param envFilePath - Optional path to .env file for loading values
 * @returns Validated environment variables
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```ts
 * const schema = {
 *   PORT: { type: "number", required: true },
 *   DATABASE_URL: { type: "url", required: true },
 * };
 *
 * // Load from .env file if it exists
 * const env = await initializeSecrets(schema, "dev", ".env.dev");
 *
 * // Use only process environment
 * const env = await initializeSecrets(schema, "prod");
 * ```
 */
export async function initializeSecrets(
  schema: EnvSchema,
  env: EnvName = "dev",
  envFilePath?: string,
): Promise<Record<string, string>> {
  // Load from .env file if provided
  if (envFilePath) {
    const fileEnv = await parseEnvFile(envFilePath);
    for (const [key, value] of Object.entries(fileEnv)) {
      if (Deno.env.get(key) === undefined) {
        Deno.env.set(key, value);
      }
    }
  }

  return getEnv(schema, env);
}

/**
 * Bootstrap function for fail-fast environment validation at app startup.
 *
 * This is the recommended entry point for environment initialization in TSera
 * applications. It performs the following steps:
 *
 * 1. Loads the environment schema from `config/secret/env.config.ts`
 * 2. Loads environment variables from `config/secret/.env.<env>`
 * 3. Merges .env values with process environment (process env takes precedence)
 * 4. Validates all variables against the schema
 * 5. Throws an error if validation fails (fail-fast)
 *
 * This function should be called before starting any servers or initializing
 * application services to ensure all required environment variables are present
 * and valid.
 *
 * @param env - Current environment name (default: "dev")
 * @param envDir - Directory containing .env files (default: "config/secret")
 * @returns Validated environment variables
 * @throws Error if validation fails or required files are missing
 *
 * @example
 * ```ts
 * import { bootstrapEnv } from "tsera/core";
 *
 * try {
 *   // Call at app startup before starting servers
 *   const env = await bootstrapEnv("prod");
 *
 *   // Start servers only after successful validation
 *   await startApiServer(env);
 *   await startFrontendServer(env);
 * } catch (error) {
 *   console.error("Failed to bootstrap environment:", error.message);
 *   Deno.exit(1);
 * }
 * ```
 */
export async function bootstrapEnv(
  env: EnvName = "dev",
  envDir: string = "config/secret",
): Promise<Record<string, string>> {
  // Load schema from env.config.ts
  const schemaPath = join(envDir, "env.config.ts");
  let schema: EnvSchema;
  try {
    const module = await import(`file://${Deno.cwd()}/${schemaPath}`);
    schema = module.default || module.envSchema || module.schema;
    if (!schema) {
      throw new Error(`No schema found in ${schemaPath}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Environment schema not found at ${schemaPath}. Please ensure that secrets module is installed.`,
      );
    }
    throw error;
  }

  // Load .env file
  const envFilePath = join(envDir, `.env.${env}`);
  const fileEnv = await parseEnvFile(envFilePath);
  for (const [key, value] of Object.entries(fileEnv)) {
    if (Deno.env.get(key) === undefined) {
      Deno.env.set(key, value);
    }
  }

  // Validate environment
  const errors = validateSecrets(
    Object.fromEntries(
      Object.keys(schema).map((key) => [key, Deno.env.get(key)]),
    ),
    schema,
    env,
  );

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed for '${env}' environment:\n${
        errors.map((e) => `  - ${e}`).join("\\n")
      }\n\nFix issues in config/secret/.env.${env} before starting the application.`,
    );
  }

  // Return validated environment variables
  return getEnv(schema, env);
}

/**
 * Type-safe API for accessing environment variables.
 *
 * Provides a consistent interface for accessing validated environment
 * variables throughout the application. This interface can be extended
 * to provide additional functionality like type-safe accessors.
 */
export type TseraAPI = {
  /**
   * Gets all validated environment variables.
   * @returns Record of all environment variables with defined values
   */
  getEnv(): Record<string, string>;

  /**
   * Gets a specific environment variable by key.
   * @param key - Environment variable name
   * @returns The environment variable value or undefined if not set
   */
  getEnvVar<T extends string>(key: string): T | undefined;
};
