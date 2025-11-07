/**
 * Database configuration supporting PostgreSQL, MySQL, and SQLite dialects.
 */
export type DbConfig =
  | {
    dialect: "postgres";
    urlEnv: string;
    ssl?: "disable" | "prefer" | "require";
    file?: undefined;
  }
  | {
    dialect: "mysql";
    urlEnv: string;
    ssl?: boolean;
    file?: undefined;
  }
  | {
    dialect: "sqlite";
    urlEnv?: string;
    file: string;
    ssl?: undefined;
  };

/**
 * Supported deployment target platforms.
 */
export type DeployTarget = "deno_deploy" | "cloudflare" | "node_pm2";

/**
 * Deployment configuration specifying the target platform and entry point.
 */
export interface DeployConfig {
  /** Target deployment platform. */
  target: DeployTarget;
  /** Entry point file for the deployment. */
  entry: string;
  /** Optional environment file path. */
  envFile?: string;
}

/**
 * Path configuration for entity and route discovery.
 */
export interface PathsConfig {
  /** Array of paths (files or directories) containing entity definitions. */
  entities: string[];
  /** Optional array of paths containing route definitions. */
  routes?: string[];
}

/**
 * Module configuration specifying which optional features are enabled.
 */
export interface ModulesConfig {
  /** Enable Hono API framework. */
  hono?: boolean;
  /** Enable Fresh frontend framework. */
  fresh?: boolean;
  /** Enable Docker Compose configuration. */
  docker?: boolean;
  /** Enable CI/CD workflows. */
  ci?: boolean;
  /** Enable type-safe secrets management. */
  secrets?: boolean;
}

/**
 * Complete TSera project configuration.
 */
export interface TseraConfig {
  /** Enables OpenAPI document generation. */
  openapi: boolean;
  /** Enables documentation generation. */
  docs: boolean;
  /** Enables test generation. */
  tests: boolean;
  /** Enables telemetry collection. */
  telemetry: boolean;
  /** Output directory for generated artifacts. */
  outDir: string;
  /** Path configuration for entity and route discovery. */
  paths: PathsConfig;
  /** Database configuration. */
  db: DbConfig;
  /** Deployment configuration. */
  deploy: DeployConfig;
  /** Optional module configuration. */
  modules?: ModulesConfig;
}

/**
 * Resolved configuration with the absolute path to the configuration file.
 */
export interface ResolvedTseraConfig {
  /** Absolute path to the tsera.config.ts file. */
  configPath: string;
  /** Validated configuration object. */
  config: TseraConfig;
}
