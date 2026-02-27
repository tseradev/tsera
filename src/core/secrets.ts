/**
 * @module core/secrets
 * Environment variable schema definition and validation for TSera.
 */

import { isAbsolute, join, resolve } from "std/path";
import { z } from "./utils/zod.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/** Default environment names used when not configured. */
export const DEFAULT_ENV_NAMES = ["dev", "staging", "prod"] as const;

/** Valid environment names type - dynamically configured via tsera.config.ts. */
export type EnvName = string;

/** Environment names configuration for dynamic validation. */
let configuredEnvNames: readonly string[] = [...DEFAULT_ENV_NAMES];

/**
 * Configure the valid environment names at runtime.
 * This should be called during application bootstrap with values from tsera.config.ts.
 */
export function configureEnvNames(envNames: readonly string[]): void {
  configuredEnvNames = envNames;
}

/**
 * Get the currently configured environment names.
 */
export function getConfiguredEnvNames(): readonly string[] {
  return configuredEnvNames;
}

/** Type guard to check if a value is a valid EnvName. */
export function isValidEnvName(value: string): value is EnvName {
  return configuredEnvNames.includes(value);
}

/** Converted environment value (string, number, boolean). */
export type EnvValue = string | number | boolean | undefined;

/** Definition of a single environment variable. */
export type EnvVarDefinition = {
  /** Zod validator for type checking and coercion */
  validator: z.ZodType;
  /** Whether the variable is required: true (always), false (optional), or array of env names */
  required: boolean | EnvName[];
};

/**
 * Type alias for EnvVarDefinition with full autocompletion support.
 * Use this type when defining individual environment variable configurations.
 */
export type EnvConfig = EnvVarDefinition;

/**
 * Helper function to define environment configuration with full autocompletion support.
 * Provides type inference and validation for the entire configuration object.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { defineEnvConfig } from "tsera/core";
 *
 * export default defineEnvConfig({
 *   DATABASE_URL: {
 *     validator: z.string().url(),
 *     required: true,
 *   },
 *   PORT: {
 *     validator: z.number(),
 *     required: false,
 *   },
 * });
 * ```
 */
export function defineEnvConfig<T extends Record<string, EnvConfig>>(config: T): T {
  return config;
}

/** Schema definition for environment configuration. */
export type EnvConfigSchema = Record<string, EnvVarDefinition>;

/** Represents an individual validation issue from Zod parsing. */
export type EnvValidationIssue = {
  path: ReadonlyArray<string | number>;
  message: string;
};

/** Environment variable validation error. */
export class EnvValidationError extends Error {
  constructor(
    public readonly errors: readonly EnvValidationIssue[],
    public readonly envName: EnvName,
  ) {
    const formattedErrors = errors
      .map((e) => {
        const path = e.path.length > 0 ? e.path.join(".") : "root";
        return `  - ${path}: ${e.message}`;
      })
      .join("\n");

    super(
      `Environment validation failed for '.env.${envName}':\n${formattedErrors}\n\n` +
        `Fix issues in config/secrets/.env.${envName} before starting the application.`,
    );
    this.name = "EnvValidationError";
  }
}

/** TSera environment variable access module. */
export type EnvModule<TEnv extends Record<string, EnvValue> = Record<string, EnvValue>> =
  & { has(key: string): boolean }
  & { [K in keyof TEnv]: TEnv[K] };

// ============================================================================
// File Parsing
// ============================================================================

/** Loads environment variables from a .env file. */
export async function parseEnvFile(
  filePath: string,
): Promise<Record<string, string>> {
  try {
    const content = await Deno.readTextFile(filePath);
    const env: Record<string, string> = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
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

/** Creates the Env module with property access support. */
export function createEnvModule<TEnv extends Record<string, EnvValue>>(
  envValues: TEnv,
): EnvModule<TEnv> {
  const baseModule = {
    has(key: string): boolean {
      return key in envValues && envValues[key] !== undefined;
    },
  };

  return new Proxy(baseModule, {
    get(
      target: typeof baseModule,
      prop: string | symbol,
      _receiver: unknown,
    ): unknown {
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop];
      }

      if (typeof prop === "string") {
        return envValues[prop as keyof TEnv];
      }

      return undefined;
    },

    has(target: typeof baseModule, prop: string | symbol): boolean {
      if (prop in target) {
        return true;
      }

      if (typeof prop === "string") {
        return prop in envValues;
      }

      return false;
    },

    ownKeys(): string[] {
      return Object.keys(envValues).concat("has");
    },

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
          value: envValues[prop as keyof TEnv],
        };
      }

      return undefined;
    },
  }) as EnvModule<TEnv>;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detects the current environment from the .env.* file values.
 * The .env.* file is the SINGLE source of truth for environment configuration.
 *
 * @param fileEnvValues - Env values loaded from .env.* file
 * @returns The environment name from DENO_ENV, or "dev" as fallback
 */
export function detectEnvName(fileEnvValues: Record<string, string>): EnvName {
  // DENO_ENV from the loaded .env.* file is the only source
  const denoEnv = fileEnvValues.DENO_ENV;
  if (denoEnv !== undefined && isValidEnvName(denoEnv)) {
    return denoEnv;
  }

  // Default fallback
  return "dev";
}

// ============================================================================
// Schema Validation Helpers
// ============================================================================

/**
 * Checks if a variable is required for the given environment.
 */
function isRequiredForEnv(
  required: boolean | EnvName[],
  envName: EnvName,
): boolean {
  if (required === true) {
    return true;
  }
  if (Array.isArray(required)) {
    return required.includes(envName);
  }
  return false;
}

/**
 * Builds a Zod schema from an EnvConfigSchema for the given environment.
 */
function buildZodSchema(
  config: EnvConfigSchema,
  envName: EnvName,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, def] of Object.entries(config)) {
    const isRequired = isRequiredForEnv(def.required, envName);
    let schema = def.validator;

    if (!isRequired) {
      // Make optional (undefined allowed)
      schema = def.validator.optional();
    }

    shape[key] = schema;
  }

  return z.object(shape);
}

/** Formats Zod validation errors into EnvValidationIssues. */
function formatZodErrors(
  issues: Array<{ path: ReadonlyArray<string | number | symbol>; message: string }>,
): EnvValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.filter((p): p is string | number =>
      typeof p === "string" || typeof p === "number"
    ),
    message: issue.message,
  }));
}

/**
 * Validates required variables that are missing (not provided and no default).
 * Returns an array of validation issues for missing required variables.
 */
function validateRequiredVariables(
  config: EnvConfigSchema,
  envValues: Record<string, string>,
  envName: EnvName,
): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];

  for (const [key, def] of Object.entries(config)) {
    const isRequired = isRequiredForEnv(def.required, envName);
    const hasValue = key in envValues && envValues[key] !== undefined && envValues[key] !== "";

    if (isRequired && !hasValue) {
      issues.push({
        path: [key],
        message: `Required environment variable '${key}' is not set`,
      });
    }
  }

  return issues;
}

// ============================================================================
// Bootstrap Function
// ============================================================================

/**
 * Validates that DENO_ENV value is one of the configured environments.
 * Returns an error message if invalid, or undefined if valid.
 */
function validateDenoEnv(
  denoEnvValue: string | undefined,
  configuredEnvs: readonly string[],
): string | undefined {
  if (denoEnvValue === undefined) {
    return undefined; // DENO_ENV not set is acceptable (will use default)
  }
  if (!configuredEnvs.includes(denoEnvValue)) {
    return `DENO_ENV value '${denoEnvValue}' is not a valid environment. ` +
      `Valid environments: ${configuredEnvs.join(", ")}`;
  }
  return undefined;
}

/**
 * Finds the first existing .env.* file in the environment directory.
 * Priority: dev, staging, prod (or configured env names in order)
 */
async function findFirstEnvFile(envDir: string): Promise<string | undefined> {
  for (const envName of configuredEnvNames) {
    const filePath = join(envDir, `.env.${envName}`);
    try {
      await Deno.stat(filePath);
      return envName;
    } catch {
      // File doesn't exist, try next
    }
  }
  return undefined;
}

/**
 * Bootstrap function for fail-fast environment validation at app startup.
 *
 * Loads the config from env.config.ts and validates .env.<env> file.
 * Uses the EnvConfigSchema format (defineEnvConfig).
 *
 * Environment detection flow:
 * 1. Find the first existing .env.* file (priority: configured env names order)
 * 2. Read DENO_ENV from that file to determine the actual environment
 * 3. If DENO_ENV points to a different env, load that file instead
 * 4. Validate the final environment values
 *
 * The .env.* file is the SINGLE source of truth for environment configuration.
 *
 * IMPORTANT: Call configureEnvNames() with values from tsera.config.ts before
 * calling this function to ensure DENO_ENV validation uses the correct environments.
 */
export async function bootstrapEnv(
  schemaPath: string = "config/secrets/env.config.ts",
  envDir: string = "config/secrets",
): Promise<Record<string, EnvValue>> {
  const absoluteSchemaPath = isAbsolute(schemaPath) ? schemaPath : resolve(Deno.cwd(), schemaPath);
  const schemaUrl = Deno.cwd() !== undefined ? `file://${absoluteSchemaPath}` : absoluteSchemaPath;

  let configModule: { default: unknown };
  try {
    configModule = await import(
      /* @vite-ignore */
      schemaUrl
    );
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      (error instanceof Error && error.message.includes("Module not found"))
    ) {
      throw new Error(
        `Environment schema not found at ${schemaPath}. Please ensure that secrets module is installed.`,
      );
    }
    throw error;
  }

  const config = configModule.default;

  // Validate that config is in EnvConfigSchema format
  const isGoodFormat = config !== null &&
    typeof config === "object" &&
    !("safeParse" in config) &&
    !("parse" in config);

  if (!isGoodFormat) {
    throw new Error(
      `Invalid schema in ${schemaPath}: expected EnvConfigSchema (use defineEnvConfig) as default export`,
    );
  }

  // Phase 1: Find the first existing .env.* file
  const initialEnvHint = await findFirstEnvFile(envDir) ?? "dev";

  // Phase 2: Load the initial .env.* file to read DENO_ENV
  const initialEnvFilePath = join(envDir, `.env.${initialEnvHint}`);
  let fileEnv = await parseEnvFile(initialEnvFilePath);

  // Phase 3: Use DENO_ENV from file as source of truth
  const envName = detectEnvName(fileEnv);

  // Phase 4: If DENO_ENV points to a different file, load that one instead
  if (envName !== initialEnvHint) {
    const correctEnvFilePath = join(envDir, `.env.${envName}`);
    fileEnv = await parseEnvFile(correctEnvFilePath);
  }

  // EnvConfigSchema format
  const envConfig = config as EnvConfigSchema;

  // Validate DENO_ENV against configured environments
  const denoEnvError = validateDenoEnv(fileEnv.DENO_ENV, configuredEnvNames);
  if (denoEnvError) {
    throw new Error(denoEnvError);
  }

  // Validate required variables first
  const requiredIssues = validateRequiredVariables(envConfig, fileEnv, envName);
  if (requiredIssues.length > 0) {
    throw new EnvValidationError(requiredIssues, envName);
  }

  // Build Zod schema dynamically from config
  const zodSchema = buildZodSchema(envConfig, envName);

  const result = zodSchema.safeParse(fileEnv);

  if (!result.success) {
    const issues = formatZodErrors(
      result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    );

    throw new EnvValidationError(issues, envName);
  }

  // Populate Deno.env with validated values for application code
  const validatedEnv = result.data as Record<string, EnvValue>;
  for (const [key, value] of Object.entries(validatedEnv)) {
    if (value !== undefined) {
      Deno.env.set(key, String(value));
    }
  }

  return validatedEnv;
}

/** Initializes the Env module at application startup. */
export async function initializeEnvModule(
  schemaPath: string = "config/secrets/env.config.ts",
  envDir: string = "config/secrets",
): Promise<EnvModule<Record<string, EnvValue>>> {
  const envValues = await bootstrapEnv(schemaPath, envDir);
  return createEnvModule(envValues);
}
