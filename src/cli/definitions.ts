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
export type DeployConfig = {
  /** Target deployment platform. */
  target: DeployTarget;
  /** Entry point file for the deployment. */
  entry: string;
  /** Optional environment file path. */
  envFile?: string;
};

/**
 * Supported deployment providers for CD (Continuous Deployment).
 */
export type DeployProvider =
  | "docker"
  | "cloudflare"
  | "deno-deploy"
  | "vercel"
  | "github";

/**
 * Path configuration for entity and route discovery.
 */
export type PathsConfig = {
  /** Array of paths (files or directories) containing entity definitions. */
  entities: string[];
  /** Optional array of paths containing route definitions. */
  routes?: string[];
};

/**
 * Module configuration specifying which optional features are enabled.
 */
export type ModulesConfig = {
  /** Enable Hono API framework. */
  hono?: boolean;
  /** Enable Lume frontend framework. */
  lume?: boolean;
  /** Enable Docker Compose configuration. */
  docker?: boolean;
  /** Enable CI/CD workflows. */
  ci?: boolean;
  /** Enable type-safe secrets management. */
  secrets?: boolean;
};

/**
 * Backend (Hono) configuration.
 */
export type BackConfig = {
  /** Server port (default: 3001). */
  port: number;
  /** Server hostname (default: "localhost"). */
  host: string;
  /** API route prefix (default: "/api/v1"). */
  apiPrefix?: string;
};

/**
 * Frontend (Lume) configuration.
 */
export type FrontConfig = {
  /** Development server port (default: 3000). */
  port: number;
  /** Source directory for Lume files (default: "./"). */
  srcDir: string;
  /** Destination directory for built files (default: "./.tsera/.temp_front"). */
  destDir: string;
};

/**
 * Complete TSera project configuration.
 */
export type TseraConfig = {
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
  /** Backend (Hono) configuration. */
  back?: BackConfig;
  /** Frontend (Lume) configuration. */
  front?: FrontConfig;
  /** Deployment configuration. */
  deploy: DeployConfig;
  /** Optional module configuration. */
  modules?: ModulesConfig;
  /**
   * List of enabled deployment providers (empty = no CD).
   * Corresponding CD workflows will be generated in .github/workflows/
   */
  deployTargets?: DeployProvider[];
};

/**
 * Resolved configuration with the absolute path to the configuration file.
 */
export type ResolvedTseraConfig = {
  /** Absolute path to the tsera.config.ts file. */
  configPath: string;
  /** Validated configuration object. */
  config: TseraConfig;
};
