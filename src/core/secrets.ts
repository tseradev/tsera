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
 * // Variable requise - garantie présente
 * const dbUrl: string = TSera.env.DATABASE_URL;
 *
 * // Variable optionnelle - peut être undefined
 * const debug: boolean | undefined = TSera.env.DEBUG;
 *
 * // Vérification avec has()
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
 * Types de conversion TypeScript pour chaque type EnvVarType.
 */
export type EnvTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  url: string; // URL est représentée comme string
};

/**
 * Infère les types TypeScript depuis un schéma EnvSchema.
 *
 * - Variables requises : type non-nullable
 * - Variables optionnelles : type nullable (| undefined)
 */
export type InferEnvTypes<TSchema extends EnvSchema> = {
  [K in keyof TSchema]: TSchema[K]["required"] extends true | EnvName[]
    ? EnvTypeMap[TSchema[K]["type"]]
    : EnvTypeMap[TSchema[K]["type"]] | undefined;
};

/**
 * Valeur d'environnement convertie (string, number, boolean).
 */
export type EnvValue = string | number | boolean | undefined;

/**
 * Module d'accès aux variables d'environnement TSera.
 *
 * Les variables requises sont garanties présentes après bootstrap.
 * Les variables optionnelles peuvent être vérifiées avec has().
 *
 * @example
 * ```ts
 * // Variable requise - garantie présente
 * const dbUrl: string = TSera.env.DATABASE_URL;
 *
 * // Variable optionnelle - peut être undefined
 * const debug: boolean | undefined = TSera.env.DEBUG;
 *
 * // Vérification avec has()
 * if (TSera.env.has("DEBUG")) {
 *   console.log("Debug mode:", TSera.env.DEBUG);
 * }
 * ```
 */
export type EnvModule<TSchema extends EnvSchema = EnvSchema> = {
  /**
   * Vérifie si une variable d'environnement optionnelle est définie.
   *
   * @param key - Nom de la variable d'environnement
   * @returns true si la variable est définie, false sinon
   */
  has(key: string): boolean;
} & {
  /**
   * Accès par propriété aux variables d'environnement.
   *
   * Les variables requises sont toujours définies (string).
   * Les variables optionnelles peuvent être undefined.
   */
  [K in keyof InferEnvTypes<TSchema>]: InferEnvTypes<TSchema>[K];
};

/**
 * Représente un problème de validation individuel.
 */
export type EnvValidationIssue = {
  /** Nom de la variable en erreur */
  variable: string;
  /** Type d'erreur */
  kind: "missing" | "invalid_type" | "invalid_format";
  /** Message d'erreur lisible */
  message: string;
  /** Type attendu (si applicable) */
  expectedType?: EnvVarType;
  /** Type réel détecté (si applicable, sans exposer la valeur) */
  actualType?: string;
};

/**
 * Erreur de validation des variables d'environnement.
 *
 * Lancée lorsqu'une ou plusieurs variables requises manquent
 * ou ont des valeurs invalides.
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
 * Convertit une valeur string en type TypeScript selon le schéma.
 *
 * @param rawValue - Valeur brute depuis l'environnement
 * @param type - Type cible depuis la définition du schéma
 * @returns Valeur convertie ou undefined si la conversion échoue
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
 * Crée le module Env avec support d'accès par propriété.
 *
 * Utilise un Proxy pour intercepter les accès aux propriétés
 * et retourner les valeurs des variables d'environnement.
 *
 * @param envValues - Variables d'environnement validées et converties
 * @param schema - Schéma de définition pour la métadonnée
 * @returns EnvModule avec accès par propriété et méthode has()
 */
export function createEnvModule<TSchema extends EnvSchema>(
  envValues: Record<string, EnvValue>,
  schema: TSchema,
): EnvModule<TSchema> {
  // Objet de base avec la méthode has()
  const baseModule = {
    has(key: string): boolean {
      return key in envValues && envValues[key] !== undefined;
    },
  };

  // Créer le Proxy pour intercepter les accès aux propriétés
  return new Proxy(baseModule, {
    /**
     * Intercepte l'accès aux propriétés (TSera.env.VARIABLE_NAME).
     */
    get(
      target: typeof baseModule,
      prop: string | symbol,
      _receiver: unknown,
    ): unknown {
      // Si c'est une méthode du module de base, la retourner
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop];
      }

      // Si c'est une propriété string, chercher la variable d'environnement
      if (typeof prop === "string") {
        // Retourner la valeur (peut être undefined pour les variables optionnelles)
        return envValues[prop];
      }

      return undefined;
    },

    /**
     * Intercepte l'opérateur `in` (ex: "DB_URL" in TSera.env).
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
     * Enumère les propriétés disponibles (Object.keys, for...in).
     */
    ownKeys(): string[] {
      return Object.keys(envValues).concat("has");
    },

    /**
     * Décrit les propriétés pour Object.getOwnPropertyDescriptor.
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
 * Valide et convertit les variables d'environnement selon le schéma.
 *
 * Cette fonction charge les variables depuis un fichier .env et les fusionne
 * avec Deno.env (process env prend précédence). Elle retourne les valeurs
 * converties selon leurs types déclarés.
 *
 * @param schema - Schéma de définition
 * @param envName - Nom de l'environnement actuel
 * @param envDir - Répertoire contenant les fichiers .env
 * @throws EnvValidationError si validation échoue
 * @returns Variables validées et converties
 */
export async function validateAndHydrateEnv<TSchema extends EnvSchema>(
  schema: TSchema,
  envName: EnvName,
  envDir: string,
): Promise<Record<string, EnvValue>> {
  // 1. Charger le fichier .env.{envName}
  const envFilePath = join(envDir, `.env.${envName}`);
  const fileEnv = await parseEnvFile(envFilePath);

  // 2. Fusionner avec Deno.env (process env prend précédence)
  const mergedEnv: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema)) {
    mergedEnv[key] = Deno.env.get(key) ?? fileEnv[key];
  }

  // 3. Valider avec détails
  const issues = validateSecretsDetailed(mergedEnv, schema, envName);

  // 4. Si erreurs, lancer l'exception
  if (issues.length > 0) {
    throw new EnvValidationError(issues, envName);
  }

  // 5. Convertir les valeurs
  const result: Record<string, EnvValue> = {};
  for (const [key, def] of Object.entries(schema)) {
    const rawValue = mergedEnv[key];
    result[key] = convertEnvValue(rawValue, def.type);
  }

  return result;
}

/**
 * Initialise le module Env au démarrage de l'application.
 *
 * Cette fonction DOIT être appelée avant toute utilisation de TSera.env.
 * Elle valide toutes les variables requises et lance une erreur
 * descriptive si validation échoue.
 *
 * @param schema - Schéma de définition des variables d'environnement
 * @param envName - Nom de l'environnement actuel (défaut: "dev")
 * @param envDir - Répertoire contenant les fichiers .env (défaut: "config/secrets")
 * @returns Module Env hydraté
 * @throws EnvValidationError si variables requises manquantes/invalides
 */
export async function initializeEnvModule<TSchema extends EnvSchema>(
  schema: TSchema,
  envName: EnvName = "dev",
  envDir: string = "config/secrets",
): Promise<EnvModule<TSchema>> {
  // Valider et hydrater
  const envValues = await validateAndHydrateEnv(schema, envName, envDir);

  // Créer le module
  return createEnvModule(envValues, schema);
}

/**
 * Détecte l'environnement actuel depuis TSERA_ENV ou NODE_ENV.
 */
export function detectEnvName(): EnvName {
  const env = Deno.env.get("TSERA_ENV") ?? Deno.env.get("NODE_ENV") ?? "dev";

  if (isValidEnvName(env)) {
    return env;
  }

  return "dev";
}

/**
 * Bootstrap function for fail-fast environment validation at app startup.
 *
 * This is the recommended entry point for environment initialization in TSera
 * applications. It performs the following steps:
 *
 * 1. Loads the environment schema from `config/secrets/env.config.ts`
 * 2. Loads environment variables from `config/secrets/.env.<env>`
 * 3. Merges .env values with process environment (process env takes precedence)
 * 4. Validates all variables against the schema
 * 5. Throws an error if validation fails (fail-fast)
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
    // Read the file directly to avoid import resolution issues
    // This bypasses Deno's import map resolution which uses the CLI's deno.jsonc
    let content = await Deno.readTextFile(schemaPath);

    // Remove import statements to avoid "Cannot use import statement outside a module" error
    // We'll define defineEnvConfig in the function scope
    content = content.replace(/^import\s+.*?from\s+.*?;?$/gm, "");

    // Extract the expression after "export default" since it's not valid in Function constructor context
    // The defineEnvConfig call will be evaluated directly
    // Use the 's' flag to make '.' match newlines, capturing the entire expression
    const exportDefaultMatch = content.match(/^export\s+default\s+(.+)$/ms);
    if (exportDefaultMatch) {
      // Use only the expression after "export default"
      content = exportDefaultMatch[1];
    }

    // Evaluate the content directly as it's now just the defineEnvConfig call
    const moduleFn = new Function(
      "defineEnvConfig",
      `return ${content};`,
    );

    // defineEnvConfig is available in this module, so we pass it
    const result = moduleFn(defineEnvConfig);
    schema = result as EnvSchema;

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

