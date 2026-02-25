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
 * - **Type Conversion**: Convert string values to proper TypeScript types
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
 * // Required variable - guaranteed to be present
 * const dbUrl: string = TSera.env.DATABASE_URL;
 *
 * // Optional variable - may be undefined
 * const debug: boolean | undefined = TSera.env.DEBUG;
 *
 * // Check with has()
 * if (TSera.env.has("DEBUG")) {
 *   console.log("Debug mode:", TSera.env.DEBUG);
 * }
 * ```
 */

import { join } from "std/path";
import { gray, red } from "../cli/ui/colors.ts";

// ============================================================================
// Type Definitions
// ============================================================================

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
 * @returns True if value is a valid environment name
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
 * Defines type, requirement rules, and optional metadata for
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
   * Provides context about variable's purpose and usage.
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

/**
 * TypeScript conversion types for each EnvVarType.
 */
export type EnvTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  url: string; // URL is represented as string
};

/**
 * Infers TypeScript types from an EnvSchema.
 *
 * - Required variables: non-nullable type
 * - Optional variables: nullable type (| undefined)
 */
export type InferEnvTypes<TSchema extends EnvSchema> = {
  [K in keyof TSchema]: TSchema[K]["required"] extends true | EnvName[]
    ? EnvTypeMap[TSchema[K]["type"]]
    : EnvTypeMap[TSchema[K]["type"]] | undefined;
};

/**
 * Converted environment value (string, number, boolean).
 */
export type EnvValue = string | number | boolean | undefined;

/**
 * TSera environment variable access module.
 *
 * Required variables are guaranteed to be present after bootstrap.
 * Optional variables can be checked with has().
 *
 * @example
 * ```ts
 * // Required variable - guaranteed to be present
 * const dbUrl: string = TSera.env.DATABASE_URL;
 *
 * // Optional variable - may be undefined
 * const debug: boolean | undefined = TSera.env.DEBUG;
 *
 * // Check with has()
 * if (TSera.env.has("DEBUG")) {
 *   console.log("Debug mode:", TSera.env.DEBUG);
 * }
 * ```
 */
export type EnvModule<TSchema extends EnvSchema = EnvSchema> = {
  /**
   * Checks if an optional environment variable is defined.
   *
   * @param key - Name of the environment variable
   * @returns true if the variable is defined, false otherwise
   */
  has(key: string): boolean;
} & {
  /**
   * Property access to environment variables.
   *
   * Required variables are always defined (string).
   * Optional variables may be undefined.
   */
  [K in keyof InferEnvTypes<TSchema>]: InferEnvTypes<TSchema>[K];
};

/**
 * Represents an individual validation issue.
 */
export type EnvValidationIssue = {
  /** Name of the variable in error */
  variable: string;
  /** Error type */
  kind: "missing" | "invalid_type" | "invalid_format";
  /** Human-readable error message */
  message: string;
  /** Expected type (if applicable) */
  expectedType?: EnvVarType;
  /** Actual detected type (if applicable, without exposing the value) */
  actualType?: string;
};

/**
 * Environment variable validation error.
 *
 * Thrown when one or more required variables are missing
 * or have invalid values.
 */
export class EnvValidationError extends Error {
  constructor(
    public readonly errors: readonly EnvValidationIssue[],
    public readonly envName: EnvName,
  ) {
    const formattedErrors = errors
      .map((e) => `  - ${e.message}`)
      .join("\n");

    super(
      `Environment validation failed for '.env.${envName}':\n${formattedErrors}\n\n` +
        `Fix issues in config/secrets/.env.${envName} before starting the application.`,
    );
    this.name = "EnvValidationError";
  }
}

// ============================================================================
// Schema Definition Helper
// ============================================================================

/**
 * Type-safe environment variable schema definition helper.
 *
 * This function provides VSCode autocomplete and strong typing for
 * environment variable schemas. It enforces required fields at compile time.
 *
 * @param schema - Environment variable schema definition
 * @returns Readonly schema with enforced types
 */
export function defineEnvConfig<T extends EnvSchema>(
  schema: T,
): Readonly<T> {
  return Object.freeze(schema);
}

// ============================================================================
// Type Validation
// ============================================================================

/**
 * Validation result type for type checking operations.
 *
 * Contains the validation status and an optional reason for failure.
 * The reason provides actionable feedback for fixing invalid values.
 */
export type ValidationResult = {
  /** Whether validation passed */
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
 * @param type - Expected type from schema definition
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
 * Determines the actual JavaScript type of an environment variable value.
 *
 * This function is used for error messages to provide type information
 * without exposing the actual value, which is critical for security.
 *
 * @param value - The string value to analyze
 * @returns The JavaScript type name as a string
 */
function getActualType(value: string): string {
  // Check if it's a boolean
  const lowerValue = value.toLowerCase();
  if (lowerValue === "true" || lowerValue === "false") {
    return "boolean";
  }

  // Check if it's a number
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    return "number";
  }

  // Check if it's a URL
  try {
    new URL(value);
    return "url";
  } catch {
    // Not a valid URL
  }

  // Default to string
  return "string";
}

/**
 * Converts a string value to TypeScript type according to the schema.
 *
 * @param rawValue - Raw value from environment
 * @param type - Target type from schema definition
 * @returns Converted value or undefined if conversion fails
 */
export function convertEnvValue(
  rawValue: string | undefined,
  type: EnvVarType,
): EnvValue {
  if (rawValue === undefined) {
    return undefined;
  }

  switch (type) {
    case "string":
    case "url":
      return rawValue;
    case "number": {
      const num = Number(rawValue);
      return isNaN(num) || !isFinite(num) ? undefined : num;
    }
    case "boolean":
      return rawValue.toLowerCase() === "true";
  }
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validates environment variables against their schema definitions.
 *
 * Performs comprehensive validation of all environment variables defined in
 * schema, checking for:
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
    } else if (
      Array.isArray(keyConfig.required) && keyConfig.required.includes(env)
    ) {
      isRequired = true;
    }

    if (value === undefined) {
      if (isRequired) {
        errors.push(
          `[${env}] Missing required var "${key}".`,
        );
      }
      continue;
    }

    // Validate type
    const typeValidation = validateType(value, keyConfig.type);
    if (!typeValidation.valid && typeValidation.reason) {
      // Determine the actual JavaScript type of the value for the error message
      // This avoids exposing sensitive values in logs while providing useful feedback
      const actualType = getActualType(value);
      errors.push(
        `[${env}] Invalid "${key}": expected ${keyConfig.type}, got ${actualType}.`,
      );
    }
  }

  return errors;
}

/**
 * Validates environment variables and returns detailed validation issues.
 *
 * This function provides structured validation results suitable for
 * the new EnvModule API with detailed error information.
 *
 * @param secrets - All environment variables (including undefined for missing keys)
 * @param schema - Environment schema defining expected variables
 * @param env - Current environment name for requirement checking
 * @returns Array of validation issues (empty if validation passes)
 */
export function validateSecretsDetailed(
  secrets: Record<string, string | undefined>,
  schema: EnvSchema,
  env: EnvName,
): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];

  for (const [key, keyConfig] of Object.entries(schema)) {
    const value = secrets[key];

    // Check if key is required for this environment
    let isRequired = false;
    if (keyConfig.required === true) {
      isRequired = true;
    } else if (
      Array.isArray(keyConfig.required) && keyConfig.required.includes(env)
    ) {
      isRequired = true;
    }

    if (value === undefined) {
      if (isRequired) {
        issues.push({
          variable: key,
          kind: "missing",
          message: `Missing required var "${key}".`,
        });
      }
      continue;
    }

    // Validate type
    const typeValidation = validateType(value, keyConfig.type);
    if (!typeValidation.valid) {
      const actualType = getActualType(value);
      issues.push({
        variable: key,
        kind: "invalid_type",
        message: `Invalid "${key}": expected ${keyConfig.type}, got ${actualType}.`,
        expectedType: keyConfig.type,
        actualType,
      });
    }
  }

  return issues;
}

// ============================================================================
// File Parsing
// ============================================================================

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

// ============================================================================
// EnvModule Creation (Proxy-based)
// ============================================================================

/**
 * Creates the Env module with property access support.
 *
 * Uses a Proxy to intercept property access
 * and return environment variable values.
 *
 * @param envValues - Validated and converted environment variables
 * @param schema - Definition schema for metadata
 * @returns EnvModule with property access and has() method
 */
export function createEnvModule<TSchema extends EnvSchema>(
  envValues: Record<string, EnvValue>,
  _schema: TSchema,
): EnvModule<TSchema> {
  // Base object with has() method
  const baseModule = {
    has(key: string): boolean {
      return key in envValues && envValues[key] !== undefined;
    },
  };

  // Create Proxy to intercept property access
  return new Proxy(baseModule, {
    /**
     * Intercepts property access (TSera.env.VARIABLE_NAME).
     */
    get(
      target: typeof baseModule,
      prop: string | symbol,
      _receiver: unknown,
    ): unknown {
      // If it's a base module method, return it
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop];
      }

      // If it's a string property, look up the environment variable
      if (typeof prop === "string") {
        // Return the value (may be undefined for optional variables)
        return envValues[prop];
      }

      return undefined;
    },

    /**
     * Intercepts the `in` operator (e.g., "DB_URL" in TSera.env).
     */
    has(target: typeof baseModule, prop: string | symbol): boolean {
      if (prop in target) {
        return true;
      }

      if (typeof prop === "string") {
        return prop in envValues;
      }

      return false;
    },

    /**
     * Enumerates available properties (Object.keys, for...in).
     */
    ownKeys(): string[] {
      return Object.keys(envValues).concat("has");
    },

    /**
     * Describes properties for Object.getOwnPropertyDescriptor.
     */
    getOwnPropertyDescriptor(
      target: typeof baseModule,
      prop: string | symbol,
    ): PropertyDescriptor | undefined {
      if (typeof prop !== "string") {
        return undefined;
      }

      if (prop === "has") {
        return {
          enumerable: true,
          configurable: true,
          value: target.has,
        };
      }

      if (prop in envValues) {
        return {
          enumerable: true,
          configurable: true,
          value: envValues[prop],
        };
      }

      return undefined;
    },
  }) as EnvModule<TSchema>;
}

// ============================================================================
// Environment Initialization
// ============================================================================

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
 * Validates and converts environment variables according to the schema.
 *
 * This function loads variables from a .env file and merges them
 * with Deno.env (process env takes precedence). It returns values
 * converted according to their declared types.
 *
 * @param schema - Definition schema
 * @param envName - Current environment name
 * @param envDir - Directory containing .env files
 * @throws EnvValidationError if validation fails
 * @returns Validated and converted variables
 */
export async function validateAndHydrateEnv<TSchema extends EnvSchema>(
  schema: TSchema,
  envName: EnvName,
  envDir: string,
): Promise<Record<string, EnvValue>> {
  // 1. Load the .env.{envName} file
  const envFilePath = join(envDir, `.env.${envName}`);
  const fileEnv = await parseEnvFile(envFilePath);

  // 2. Merge with Deno.env (process env takes precedence)
  const mergedEnv: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema)) {
    mergedEnv[key] = Deno.env.get(key) ?? fileEnv[key];
  }

  // 3. Validate with details
  const issues = validateSecretsDetailed(mergedEnv, schema, envName);

  // 4. If errors, throw exception
  if (issues.length > 0) {
    throw new EnvValidationError(issues, envName);
  }

  // 5. Convert values
  const result: Record<string, EnvValue> = {};
  for (const [key, def] of Object.entries(schema)) {
    const rawValue = mergedEnv[key];
    result[key] = convertEnvValue(rawValue, def.type);
  }

  return result;
}

/**
 * Initializes the Env module at application startup.
 *
 * This function MUST be called before any use of TSera.env.
 * It validates all required variables and throws a descriptive
 * error if validation fails.
 *
 * @param schema - Environment variable definition schema
 * @param envName - Current environment name (default: "dev")
 * @param envDir - Directory containing .env files (default: "config/secrets")
 * @returns Hydrated Env module
 * @throws EnvValidationError if required variables are missing/invalid
 */
export async function initializeEnvModule<TSchema extends EnvSchema>(
  schema: TSchema,
  envName: EnvName = "dev",
  envDir: string = "config/secrets",
): Promise<EnvModule<TSchema>> {
  // Validate and hydrate
  const envValues = await validateAndHydrateEnv(schema, envName, envDir);

  // Create the module
  return createEnvModule(envValues, schema);
}

/**
 * Detects the current environment from TSERA_ENV or NODE_ENV.
 *
 * @returns The detected environment name (defaults to "dev")
 */
export function detectEnvName(): EnvName {
  const env = Deno.env.get("TSERA_ENV") ?? Deno.env.get("NODE_ENV") ?? "dev";

  if (isValidEnvName(env)) {
    return env;
  }

  return "dev";
}

/**
 * SECURITY WHITELIST: Allowed patterns in env.config.ts
 *
 * Only these patterns are allowed in the configuration file:
 * - Import statements from @tsera/core (for defineEnvConfig)
 * - Export default statements
 * - Object literals with type, required, description fields
 * - String literals (type names, descriptions)
 * - Boolean literals (true/false)
 * - Array literals (for environment-specific requirements)
 * - Comments (single-line and multi-line)
 * - Whitespace and newlines
 */
const _ALLOWED_PATTERNS = [
  // Import statements from @tsera/core only
  /^import\s*\{\s*defineEnvConfig\s*\}\s*from\s*["']@tsera\/core["'];?$/gm,
  // Export default with defineEnvConfig
  /^export\s+default\s+defineEnvConfig\s*\(/gm,
  // Object property names (UPPER_CASE with underscores)
  /^\s*[A-Z][A-Z0-9_]*\s*:/gm,
  // Type field with valid values
  /^\s*type\s*:\s*["'](?:string|number|boolean|url)["']/gm,
  // Required field with boolean or array
  /^\s*required\s*:\s*(?:true|false|\[)/gm,
  // Description field
  /^\s*description\s*:\s*["']/gm,
  // Array of environment names
  /^\s*\[\s*["'](?:dev|staging|prod)["']\s*(?:,\s*["'](?:dev|staging|prod)["']\s*)*\]/gm,
  // Object braces and commas
  /^[\s{}[\],]*$/gm,
  // Comments
  /^\s*\/\/.*$/gm,
  /^\s*\/\*[\s\S]*?\*\/$/gm,
  // defineEnvConfig call closing
  /^\s*\}\s*\)\s*;?\s*$/gm,
  // Empty lines and whitespace
  /^\s*$/gm,
];

/**
 * FORBIDDEN PATTERNS: Patterns that are explicitly blocked
 *
 * These patterns are never allowed in configuration files:
 * - Dynamic code execution (eval, Function constructor)
 * - Module system manipulation (require, dynamic import)
 * - Environment/process access (Deno.env, process)
 * - Global object access (globalThis, window, document)
 * - Network operations (fetch, XMLHttpRequest)
 * - File system operations (readFile, writeFile)
 * - Code obfuscation attempts (hex strings, unicode escapes)
 */
const FORBIDDEN_PATTERNS = [
  // Code execution
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bnew\s+Function\b/i,
  // Module system
  /\brequire\s*\(/i,
  /\bimport\s*\(/i,
  /\bexport\s+\*/i,
  // Environment/Process access
  /\bDeno\s*\./i,
  /\bprocess\s*\./i,
  /\bprocess\.env\b/i,
  // Global objects
  /\bglobalThis\b/i,
  /\bwindow\s*\./i,
  /\bdocument\s*\./i,
  /\bglobal\s*\./i,
  // Network
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bWebSocket\b/i,
  // File system
  /\breadFile/i,
  /\bwriteFile/i,
  /\bDeno\.read/i,
  /\bDeno\.write/i,
  // Code injection patterns
  /\\x[0-9a-f]{2}/i, // Hex escapes
  /\\u[0-9a-f]{4}/i, // Unicode escapes
  /\batob\s*\(/i,
  /\bbtoa\s*\(/i,
  // Prototype pollution
  /\b__proto__\b/i,
  /\bprototype\s*\[/i,
  /\bconstructor\s*\[/i,
  // Template literals with expressions (potential injection)
  /`[^`]*\$\{[^}]+\}[^`]*`/,
];

/**
 * Validates the content of an env.config.ts file for security.
 *
 * This function performs a two-pass validation:
 * 1. Check for forbidden patterns (block immediately if found)
 * 2. Verify that remaining content matches allowed patterns
 *
 * @param content - The file content to validate
 * @param filePath - Path to the file (for error messages)
 * @throws Error if forbidden patterns are found or content doesn't match allowed patterns
 */
function validateEnvConfigSecurity(content: string, filePath: string): void {
  // Pass 1: Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(
        `Security: Forbidden pattern detected in ${filePath}. ` +
          `The configuration file contains potentially dangerous code. ` +
          `Only static object literals with type, required, and description fields are allowed.`,
      );
    }
  }

  // Pass 2: Normalize content and check structure
  // Remove all allowed patterns and check if anything remains
  let normalizedContent = content;

  // Remove comments first
  normalizedContent = normalizedContent.replace(/^\s*\/\/.*$/gm, "");
  normalizedContent = normalizedContent.replace(/^\s*\/\*[\s\S]*?\*\/$/gm, "");

  // Remove import statements
  normalizedContent = normalizedContent.replace(
    /^import\s*\{\s*defineEnvConfig\s*\}\s*from\s*["']@tsera\/core["'];?\s*$/gm,
    "",
  );

  // Remove export default defineEnvConfig wrapper
  normalizedContent = normalizedContent.replace(
    /^export\s+default\s+defineEnvConfig\s*\(\s*\{/gm,
    "{",
  );
  normalizedContent = normalizedContent.replace(/^\s*\}\s*\)\s*;?\s*$/gm, "}");

  // Check for remaining suspicious content
  // After removing all allowed patterns, only whitespace and structural chars should remain
  const suspiciousRemaining = normalizedContent
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      // Allow object structure
      if (/^[\s{}[\],:]*$/.test(line)) return false;
      // Allow property definitions
      if (/^\s*[A-Z][A-Z0-9_]*\s*:/.test(line)) return false;
      // Allow type values
      if (/^\s*type\s*:\s*["'](?:string|number|boolean|url)["']\s*,?\s*$/.test(line)) return false;
      // Allow required values
      if (/^\s*required\s*:\s*(?:true|false)\s*,?\s*$/.test(line)) return false;
      // Allow required arrays
      if (/^\s*required\s*:\s*\[/.test(line)) return false;
      if (/^\s*\[\s*["'](?:dev|staging|prod)["']/.test(line)) return false;
      if (/^\s*["'](?:dev|staging|prod)["']\s*,?\s*\]?/.test(line)) return false;
      // Allow description
      if (/^\s*description\s*:\s*["'].*["']\s*,?\s*$/.test(line)) return false;
      // Allow closing braces
      if (/^\s*\}\s*,?\s*$/.test(line)) return false;
      return true;
    });

  if (suspiciousRemaining.length > 0) {
    throw new Error(
      `Security: Unrecognized content in ${filePath}. ` +
        `Lines with suspicious content: ${suspiciousRemaining.slice(0, 3).join("; ")}... ` +
        `Only static configuration objects are allowed.`,
    );
  }
}

/**
 * Extracts the schema object from validated env.config.ts content.
 *
 * This function parses the configuration file content and extracts
 * the schema object WITHOUT using eval or Function constructor.
 * It uses a safe parsing approach that only handles object literals.
 *
 * @param content - The validated file content
 * @returns The parsed EnvSchema object
 * @throws Error if the content cannot be safely parsed
 */
function parseEnvConfigContent(content: string): EnvSchema {
  // Extract the object literal from the content
  // Match the object between defineEnvConfig({ ... })
  const defineMatch = content.match(
    /defineEnvConfig\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/,
  );

  let objectContent: string;
  if (defineMatch) {
    objectContent = defineMatch[1];
  } else {
    // Try matching export default { ... }
    const exportMatch = content.match(/export\s+default\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (exportMatch) {
      objectContent = exportMatch[1];
    } else {
      // Assume the content is already just an object
      objectContent = content.trim();
      if (!objectContent.startsWith("{")) {
        throw new Error("Invalid configuration format: expected object literal");
      }
    }
  }

  // Parse the object literal safely
  // We use a JSON-like parsing approach with support for:
  // - Unquoted keys (UPPER_CASE)
  // - Single and double quoted strings
  // - Boolean literals
  // - Array literals
  try {
    // Transform the object content to valid JSON for parsing
    // This is safer than eval because we control the transformation
    const jsonContent = objectContent
      // Add quotes around unquoted property names
      .replace(/([A-Z][A-Z0-9_]*)\s*:/g, '"$1":')
      // Remove trailing commas (not valid in JSON)
      .replace(/,\s*([}\]])/g, "$1")
      // Convert single quotes to double quotes for strings
      .replace(/'/g, '"');

    const parsed = JSON.parse(jsonContent);

    // Validate the parsed structure matches EnvSchema format
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "object" || value === null) {
        throw new Error(`Invalid schema entry for "${key}": expected object`);
      }

      const entry = value as Record<string, unknown>;
      if (!("type" in entry)) {
        throw new Error(`Invalid schema entry for "${key}": missing "type" field`);
      }
      if (!("required" in entry)) {
        throw new Error(`Invalid schema entry for "${key}": missing "required" field`);
      }

      // Validate type value
      const validTypes = ["string", "number", "boolean", "url"];
      if (!validTypes.includes(entry.type as string)) {
        throw new Error(
          `Invalid schema entry for "${key}": type must be one of ${validTypes.join(", ")}`,
        );
      }

      // Validate required value
      if (
        typeof entry.required !== "boolean" &&
        !Array.isArray(entry.required)
      ) {
        throw new Error(
          `Invalid schema entry for "${key}": required must be boolean or array`,
        );
      }
    }

    return parsed as EnvSchema;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse configuration: ${error.message}. ` +
          `Ensure the configuration file contains valid JSON-like syntax.`,
      );
    }
    throw error;
  }
}

/**
 * Bootstrap function for fail-fast environment validation at app startup.
 *
 * This is the recommended entry point for environment initialization in TSera
 * applications. It performs the following steps:
 *
 * 1. Loads the environment schema from `config/secrets/env.config.ts`
 * 2. Validates the schema file for security (no arbitrary code execution)
 * 3. Parses the schema using safe JSON-like parsing (no eval/Function)
 * 4. Loads environment variables from `config/secrets/.env.<env>`
 * 5. Merges .env values with process environment (process env takes precedence)
 * 6. Validates all variables against the schema
 * 7. Throws an error if validation fails (fail-fast)
 *
 * ## Security Architecture
 *
 * This function uses a secure parsing approach that:
 * - Validates content against a whitelist of allowed patterns
 * - Blocks forbidden patterns (eval, Function, Deno.*, etc.)
 * - Parses configuration using JSON.parse() instead of eval()
 * - Never executes arbitrary code from configuration files
 *
 * This function should be called before starting any servers or initializing
 * application services to ensure all required environment variables are present
 * and valid.
 *
 * @param env - Current environment name (default: "dev")
 * @param envDir - Directory containing .env files (default: "config/secrets")
 * @returns Validated environment variables
 * @throws Error if validation fails or required files are missing
 */
export async function bootstrapEnv(
  env: EnvName = "dev",
  envDir: string = "config/secrets",
): Promise<Record<string, string>> {
  // Load schema from env.config.ts
  const schemaPath = join(envDir, "env.config.ts");
  let schema: EnvSchema;

  try {
    // Read the configuration file
    const content = await Deno.readTextFile(schemaPath);

    // SECURITY: Validate content before parsing
    // This prevents arbitrary code execution by checking for forbidden patterns
    validateEnvConfigSecurity(content, schemaPath);

    // Parse the configuration safely (no eval, no Function constructor)
    schema = parseEnvConfigContent(content);

    if (!schema || Object.keys(schema).length === 0) {
      throw new Error(`No valid schema found in ${schemaPath}`);
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
      `Environment validation failed for '.env.${env}':\n${
        errors.map((e) => `${gray("│")} ${red(` - ${e}`)}`).join("\\n")
      }\n${gray("│")}  ${
        red(
          `Fix issues in config/secrets/.env.${env} before starting the application.`,
        )
      }`,
    );
  }

  // Return validated environment variables
  return getEnv(schema, env);
}

