/**
 * @module core/secrets
 * Environment variable schema definition and validation for TSera.
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
 * import { defineEnvConfig } from "tsera/core";
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

/**
 * Validates a value against its type.
 *
 * @param value - Raw string value from environment
 * @param type - Expected type
 * @returns Validation result with optional reason
 */
export function validateType(
  value: string,
  type: EnvVarType,
): { valid: boolean; reason?: string } {
  switch (type) {
    case "string":
      return { valid: typeof value === "string" };
    case "number":
      const num = Number(value);
      return { valid: !isNaN(num) && isFinite(num), reason: "must be a number" };
    case "boolean":
      const boolValue = value.toLowerCase();
      return {
        valid: boolValue === "true" || boolValue === "false",
        reason: "must be 'true' or 'false'",
      };
    case "url":
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, reason: "must be a valid URL" };
      }
  }
}

/**
 * Validates environment variables against schema.
 *
 * @param secrets - All environment variables (including undefined for missing)
 * @param schema - Environment schema
 * @param env - Current environment name
 * @returns Validation errors array
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
 * @param filePath - Path to .env file
 * @returns Parsed environment variables
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
 * Gets environment variables with validation.
 *
 * @param schema - Environment schema
 * @param env - Current environment name
 * @returns Validated environment variables
 * @throws Error if validation fails
 */
export async function getEnv(
  schema: EnvSchema,
  env: EnvName = "dev",
): Promise<Record<string, string>> {
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
 * @param schema - Environment schema
 * @param env - Current environment name
 * @param envFilePath - Optional path to .env file
 * @returns Validated environment variables
 * @throws Error if validation fails
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
 * Type-safe API for accessing environment variables.
 */
export interface TseraAPI {
  getEnv(): Record<string, string>;
  getEnvVar<T extends string>(key: string): T | undefined;
}
