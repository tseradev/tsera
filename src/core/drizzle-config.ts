/**
 * @module core/drizzle-config
 * Drizzle ORM configuration utilities for TSera.
 *
 * This module provides centralized database configuration resolution
 * with type-safe environment variable access and validation.
 *
 * ## Core Responsibilities
 *
 * - **URL Resolution**: Resolve database URL from environment with fallbacks
 * - **Provider Validation**: Validate database provider configuration
 * - **Format Validation**: Ensure database URLs match expected formats
 * - **Configuration Generation**: Generate Drizzle Kit configuration objects
 *
 * ## Security Considerations
 *
 * - Never log raw database URLs in error messages
 * - Validation errors provide actionable guidance without exposing sensitive data
 *
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported database dialects in TSera.
 */
export type DatabaseDialect = "sqlite" | "postgresql" | "mysql";

/**
 * Database credentials for SQLite.
 */
export type SqliteCredentials = {
  url: string;
};

/**
 * Database credentials for PostgreSQL.
 */
export type PostgresCredentials = {
  url: string;
  ssl?: "disable" | "prefer" | "require";
};

/**
 * Database credentials for MySQL.
 */
export type MysqlCredentials = {
  url: string;
  ssl?: boolean;
};

/**
 * Database credentials union type.
 */
export type DatabaseCredentials =
  | { dialect: "sqlite"; credentials: SqliteCredentials }
  | { dialect: "postgresql"; credentials: PostgresCredentials }
  | { dialect: "mysql"; credentials: MysqlCredentials };

/**
 * Drizzle Kit configuration for SQLite.
 */
export type DrizzleSqliteConfig = {
  schema: string;
  out: string;
  dialect: "sqlite";
  dbCredentials: SqliteCredentials;
};

/**
 * Drizzle Kit configuration for PostgreSQL.
 */
export type DrizzlePostgresConfig = {
  schema: string;
  out: string;
  dialect: "postgresql";
  dbCredentials: PostgresCredentials;
};

/**
 * Drizzle Kit configuration for MySQL.
 */
export type DrizzleMysqlConfig = {
  schema: string;
  out: string;
  dialect: "mysql";
  dbCredentials: MysqlCredentials;
};

/**
 * Drizzle Kit configuration union type.
 */
export type DrizzleConfig =
  | DrizzleSqliteConfig
  | DrizzlePostgresConfig
  | DrizzleMysqlConfig;

/**
 * Options for resolving database URL.
 */
export type ResolveDatabaseUrlOptions = {
  /** Environment variable names to check in order (default: ["DATABASE_URL", "TSERA_DATABASE_URL"]) */
  envKeys?: string[];
  /** Whether to validate URL format (default: true) */
  validateFormat?: boolean;
  /** Expected URL prefix for validation (e.g., "file:" for SQLite) */
  expectedPrefix?: string;
};

/**
 * Options for creating Drizzle configuration.
 */
export type CreateDrizzleConfigOptions = {
  /** Path to schema files (default: "./.tsera/db/schemas/*.ts") */
  schema?: string;
  /** Output directory for migrations (default: "./.tsera/db/migrations") */
  out?: string;
  /** Database dialect (default: "sqlite") */
  dialect?: DatabaseDialect;
  /** Custom database URL (overrides environment) */
  databaseUrl?: string;
};

// ============================================================================
// Environment Resolution
// ============================================================================

/**
 * Type guard for TSera env accessor.
 */
type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

function isTseraEnvAccessor(value: unknown): value is TseraEnvAccessor {
  return typeof value === "object" && value !== null &&
    typeof (value as Record<string, unknown>)["env"] === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Get the TSera runtime env accessor if available.
 *
 * @returns TSera env accessor or undefined
 */
function getTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["tsera"];
  if (!isTseraEnvAccessor(tsera)) {
    return undefined;
  }
  return tsera;
}

/**
 * Read a string value from an unknown source.
 *
 * @param value - Unknown value to read
 * @returns String value or undefined
 */
function readEnvString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Resolve a single environment variable from multiple sources.
 *
 * Priority order:
 * 1. TSera runtime env (if secrets module is enabled)
 * 2. Deno.env
 *
 * @param key - Environment variable name
 * @returns String value or undefined
 */
export function resolveEnvVar(key: string): string | undefined {
  const tseraEnv = getTseraEnv();
  return readEnvString(tseraEnv?.env(key)) ?? Deno.env.get(key);
}

/**
 * Resolve database URL from environment with fallbacks.
 *
 * Checks multiple environment variable names in order and validates
 * the URL format if required.
 *
 * @param options - Resolution options
 * @returns Database URL
 * @throws Error if URL is missing or invalid
 *
 * @example
 * ```ts
 * // Default behavior (SQLite)
 * const url = resolveDatabaseUrl();
 *
 * // Custom options
 * const url = resolveDatabaseUrl({
 *   envKeys: ["MY_DB_URL", "DATABASE_URL"],
 *   expectedPrefix: "postgresql:",
 * });
 * ```
 */
export function resolveDatabaseUrl(
  options: ResolveDatabaseUrlOptions = {},
): string {
  const {
    envKeys = ["DATABASE_URL", "TSERA_DATABASE_URL"],
    validateFormat = true,
    expectedPrefix,
  } = options;

  // Try each environment key in order
  let databaseUrl: string | undefined;
  for (const key of envKeys) {
    databaseUrl = resolveEnvVar(key);
    if (databaseUrl) {
      break;
    }
  }

  if (!databaseUrl) {
    const keysList = envKeys.map((k) => `"${k}"`).join(" or ");
    throw new Error(
      `Database URL not found. Set ${keysList} in your environment or config/secrets/.env.* file.`,
    );
  }

  // Validate format if required
  if (validateFormat && expectedPrefix) {
    if (!databaseUrl.startsWith(expectedPrefix)) {
      throw new Error(
        `Database URL must start with "${expectedPrefix}". ` +
          `Check your environment configuration.`,
      );
    }
  }

  return databaseUrl;
}

/**
 * Resolve database provider from environment.
 *
 * @returns Database provider name
 * @throws Error if provider is missing or invalid
 */
export function resolveDatabaseProvider(): string {
  const provider = resolveEnvVar("DATABASE_PROVIDER");

  if (!provider) {
    throw new Error(
      'DATABASE_PROVIDER is required. Set it to "sqlite", "postgresql", or "mysql" in your environment.',
    );
  }

  const validProviders = ["sqlite", "postgresql", "mysql"];
  if (!validProviders.includes(provider)) {
    throw new Error(
      `DATABASE_PROVIDER must be one of: ${validProviders.join(", ")}. Got: "${provider}"`,
    );
  }

  return provider;
}

// ============================================================================
// Configuration Generation
// ============================================================================

/**
 * Create Drizzle Kit configuration for SQLite.
 *
 * @param options - Configuration options
 * @returns Drizzle Kit configuration object
 */
export function createSqliteConfig(
  options: CreateDrizzleConfigOptions = {},
): DrizzleSqliteConfig {
  const {
    schema = "./.tsera/db/schemas/*.ts",
    out = "./.tsera/db/migrations",
    databaseUrl,
  } = options;

  const url = databaseUrl ?? resolveDatabaseUrl({
    expectedPrefix: "file:",
  });

  return {
    schema,
    out,
    dialect: "sqlite",
    dbCredentials: { url },
  };
}

/**
 * Create Drizzle Kit configuration for PostgreSQL.
 *
 * @param options - Configuration options
 * @returns Drizzle Kit configuration object
 */
export function createPostgresConfig(
  options: CreateDrizzleConfigOptions = {},
): DrizzlePostgresConfig {
  const {
    schema = "./.tsera/db/schemas/*.ts",
    out = "./.tsera/db/migrations",
    databaseUrl,
  } = options;

  const url = databaseUrl ?? resolveDatabaseUrl({
    expectedPrefix: "postgresql:",
  });

  const sslValue = resolveEnvVar("DATABASE_SSL");
  const ssl = sslValue as "disable" | "prefer" | "require" | undefined;

  return {
    schema,
    out,
    dialect: "postgresql",
    dbCredentials: { url, ssl },
  };
}

/**
 * Create Drizzle Kit configuration for MySQL.
 *
 * @param options - Configuration options
 * @returns Drizzle Kit configuration object
 */
export function createMysqlConfig(
  options: CreateDrizzleConfigOptions = {},
): DrizzleMysqlConfig {
  const {
    schema = "./.tsera/db/schemas/*.ts",
    out = "./.tsera/db/migrations",
    databaseUrl,
  } = options;

  const url = databaseUrl ?? resolveDatabaseUrl({
    expectedPrefix: "mysql:",
  });

  const sslValue = resolveEnvVar("DATABASE_SSL");
  const ssl = sslValue === "true";

  return {
    schema,
    out,
    dialect: "mysql",
    dbCredentials: { url, ssl },
  };
}

/**
 * Create Drizzle Kit configuration based on database provider.
 *
 * This is the main entry point for generating Drizzle configuration.
 * It automatically detects the database provider from environment
 * and creates the appropriate configuration.
 *
 * @param options - Configuration options
 * @returns Drizzle Kit configuration object
 * @throws Error if provider is invalid or configuration is missing
 *
 * @example
 * ```ts
 * // drizzle.config.ts
 * import { createDrizzleConfig } from "tsera/core/drizzle-config";
 *
 * export default createDrizzleConfig();
 * ```
 */
export function createDrizzleConfig(
  options: CreateDrizzleConfigOptions = {},
): DrizzleConfig {
  const { dialect = "sqlite" } = options;

  switch (dialect) {
    case "sqlite":
      return createSqliteConfig(options);
    case "postgresql":
      return createPostgresConfig(options);
    case "mysql":
      return createMysqlConfig(options);
    default:
      throw new Error(`Unsupported database dialect: ${dialect}`);
  }
}

// ============================================================================
// TSera Config Integration
// ============================================================================

/**
 * TSera database configuration type (subset of TseraConfig).
 * This type is used to avoid circular dependencies.
 */
type TseraDbConfig = {
  dialect: "postgres" | "mysql" | "sqlite";
  urlEnv?: string;
  file?: string;
  ssl?: "disable" | "prefer" | "require" | boolean;
};

/**
 * TSera configuration type (subset for Drizzle config generation).
 */
type TseraConfigLike = {
  db: TseraDbConfig;
  outDir?: string;
};

/**
 * Map TSera dialect to Drizzle dialect.
 */
function mapDialect(dialect: TseraDbConfig["dialect"]): DatabaseDialect {
  const dialectMap: Record<string, DatabaseDialect> = {
    postgres: "postgresql",
    postgresql: "postgresql",
    mysql: "mysql",
    sqlite: "sqlite",
  };
  return dialectMap[dialect] ?? "sqlite";
}

/**
 * Create Drizzle Kit configuration from TSera configuration.
 *
 * This function reads the database configuration from a TSera config object
 * and generates the appropriate Drizzle Kit configuration. It handles
 * all supported dialects (SQLite, PostgreSQL, MySQL) and resolves
 * credentials from environment variables when needed.
 *
 * @param config - TSera configuration object
 * @returns Drizzle Kit configuration object
 * @throws Error if configuration is invalid or missing required values
 *
 * @example
 * ```ts
 * // drizzle.config.ts
 * import { createDrizzleConfigFromTsera } from "tsera/core/drizzle-config";
 * import tseraConfig from "../tsera.config.ts";
 *
 * export default createDrizzleConfigFromTsera(tseraConfig);
 * ```
 */
export function createDrizzleConfigFromTsera(
  config: TseraConfigLike,
): DrizzleConfig {
  const dbConfig = config.db;
  const dialect = mapDialect(dbConfig.dialect);
  const outDir = config.outDir ?? ".tsera";

  switch (dialect) {
    case "sqlite": {
      // For SQLite, use the file path from config or default
      const filePath = dbConfig.file ?? "./app/db/tsera.sqlite";
      return {
        schema: `./${outDir}/db/schemas/*.ts`,
        out: `./${outDir}/db/migrations`,
        dialect: "sqlite",
        dbCredentials: { url: `file:${filePath}` },
      };
    }

    case "postgresql": {
      // For PostgreSQL, resolve URL from environment variable
      const urlEnv = dbConfig.urlEnv ?? "TSERA_DATABASE_URL";
      const url = resolveEnvVar(urlEnv) ?? resolveEnvVar("DATABASE_URL");

      if (!url) {
        throw new Error(
          `Database URL not found. Set "${urlEnv}" or "DATABASE_URL" in your environment.`,
        );
      }

      return {
        schema: `./${outDir}/db/schemas/*.ts`,
        out: `./${outDir}/db/migrations`,
        dialect: "postgresql",
        dbCredentials: {
          url,
          ssl: dbConfig.ssl as "disable" | "prefer" | "require" | undefined,
        },
      };
    }

    case "mysql": {
      // For MySQL, resolve URL from environment variable
      const urlEnv = dbConfig.urlEnv ?? "TSERA_DATABASE_URL";
      const url = resolveEnvVar(urlEnv) ?? resolveEnvVar("DATABASE_URL");

      if (!url) {
        throw new Error(
          `Database URL not found. Set "${urlEnv}" or "DATABASE_URL" in your environment.`,
        );
      }

      return {
        schema: `./${outDir}/db/schemas/*.ts`,
        out: `./${outDir}/db/migrations`,
        dialect: "mysql",
        dbCredentials: {
          url,
          ssl: typeof dbConfig.ssl === "boolean" ? dbConfig.ssl : undefined,
        },
      };
    }

    default:
      throw new Error(`Unsupported database dialect: ${dialect}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get database credentials for runtime connection.
 *
 * This function is used by the database connection module to get
 * validated credentials for establishing a connection.
 *
 * @param dialect - Database dialect
 * @returns Database credentials
 * @throws Error if configuration is missing or invalid
 */
export function getDatabaseCredentials(dialect: DatabaseDialect): string {
  const prefixMap: Record<DatabaseDialect, string> = {
    sqlite: "file:",
    postgresql: "postgresql:",
    mysql: "mysql:",
  };

  return resolveDatabaseUrl({
    expectedPrefix: prefixMap[dialect],
  });
}

/**
 * Validate that the database configuration is complete.
 *
 * @returns True if configuration is valid
 * @throws Error if configuration is incomplete or invalid
 */
export function validateDatabaseConfig(): boolean {
  const provider = resolveDatabaseProvider();
  const dialect = provider as DatabaseDialect;

  // This will throw if the URL is missing or invalid
  getDatabaseCredentials(dialect);

  return true;
}
