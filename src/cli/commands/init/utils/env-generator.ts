/**
 * Environment file generation for TSera projects.
 * Generates .env files for each environment with appropriate default values.
 *
 * @module
 */

import type { DbConfig } from "../../../definitions.ts";

/**
 * Configuration for generating environment files.
 */
export interface EnvGenerationConfig {
  db: DbConfig;
  modules: string[];
}

/**
 * Generates .env files for all environments with appropriate default values.
 *
 * @param config - Generation configuration.
 * @returns Object mapping file names to content.
 */
export function generateEnvFiles(
  config: EnvGenerationConfig,
): Record<string, string> {
  const { db, modules } = config;

  const files: Record<string, string> = {
    ".env.dev": generateDevEnv(db, modules),
    ".env.staging": generateStagingEnv(db, modules),
    ".env.prod": generateProdEnv(db, modules),
  };

  return files;
}

/**
 * Generates development environment file.
 */
function generateDevEnv(db: DbConfig, modules: string[]): string {
  const lines: string[] = [
    "# Development Environment",
    "# This file is loaded when TSERA_ENV is not set or set to 'dev'",
    "# Fill in all required values below before starting the application",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_URL=postgresql://localhost:5432/tsera_dev");
    lines.push("DATABASE_SSL=disable");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_URL=mysql://localhost:3306/tsera_dev");
    lines.push("DATABASE_SSL=false");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_URL=file:./data/tsera_dev.db");
  }

  lines.push("");

  // Hono module
  if (modules.includes("hono")) {
    lines.push("# API Server (Hono)");
    lines.push("PORT=3000");
    lines.push("HOST=localhost");
    lines.push("API_PREFIX=/api");
    lines.push("");
  }

  // Lume module
  if (modules.includes("lume")) {
    lines.push("# Frontend Server (Lume)");
    lines.push("LUME_PORT=8001");
    lines.push("");
  }

  // Docker module
  if (modules.includes("docker")) {
    lines.push("# Docker Configuration");
    lines.push("DOCKER_REGISTRY=");
    lines.push("DOCKER_IMAGE_NAME=tsera-app");
    lines.push("");
  }

  // CI module
  if (modules.includes("ci")) {
    lines.push("# CI Configuration");
    lines.push("DEPLOY_TOKEN=dev-token-not-used-locally");
    lines.push("CI_REGISTRY=");
    lines.push("");
  }

  lines.push("# Debugging");
  lines.push("DEBUG=true");

  return lines.join("\n");
}

/**
 * Generates staging environment file.
 */
function generateStagingEnv(db: DbConfig, modules: string[]): string {
  const lines: string[] = [
    "# Staging Environment",
    "# This file is loaded when TSERA_ENV=staging",
    "# Fill in all required values below before starting the application",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_URL=postgresql://staging-host:5432/tsera_staging");
    lines.push("DATABASE_SSL=prefer");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_URL=mysql://staging-host:3306/tsera_staging");
    lines.push("DATABASE_SSL=true");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_URL=file:./data/tsera_staging.db");
  }

  lines.push("");

  // Hono module
  if (modules.includes("hono")) {
    lines.push("# API Server (Hono)");
    lines.push("PORT=8080");
    lines.push("HOST=0.0.0.0");
    lines.push("API_PREFIX=/api/v1");
    lines.push("");
  }

  // Lume module
  if (modules.includes("lume")) {
    lines.push("# Frontend Server (Lume)");
    lines.push("LUME_PORT=8080");
    lines.push("");
  }

  // Docker module
  if (modules.includes("docker")) {
    lines.push("# Docker Configuration");
    lines.push("DOCKER_REGISTRY=registry.example.com");
    lines.push("DOCKER_IMAGE_NAME=tsera-app");
    lines.push("");
  }

  // CI module
  if (modules.includes("ci")) {
    lines.push("# CI Configuration");
    lines.push("DEPLOY_TOKEN=CHANGE_ME_STAGING_DEPLOY_TOKEN");
    lines.push("CI_REGISTRY=registry.example.com");
    lines.push("");
  }

  lines.push("# Debugging");
  lines.push("DEBUG=false");

  return lines.join("\n");
}

/**
 * Generates production environment file.
 */
function generateProdEnv(db: DbConfig, modules: string[]): string {
  const lines: string[] = [
    "# Production Environment",
    "# This file is loaded when TSERA_ENV=prod",
    "# ⚠️  IMPORTANT: Fill in all required values before deploying to production!",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_URL=CHANGE_ME_PROD_POSTGRESQL_URL");
    lines.push("DATABASE_SSL=require");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_URL=CHANGE_ME_PROD_MYSQL_URL");
    lines.push("DATABASE_SSL=true");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_URL=file:./data/tsera_prod.db");
  }

  lines.push("");

  // Hono module
  if (modules.includes("hono")) {
    lines.push("# API Server (Hono)");
    lines.push("PORT=8080");
    lines.push("HOST=0.0.0.0");
    lines.push("API_PREFIX=/api/v1");
    lines.push("");
  }

  // Lume module
  if (modules.includes("lume")) {
    lines.push("# Frontend Server (Lume)");
    lines.push("LUME_PORT=8080");
    lines.push("");
  }

  // Docker module
  if (modules.includes("docker")) {
    lines.push("# Docker Configuration");
    lines.push("DOCKER_REGISTRY=CHANGE_ME_PROD_REGISTRY");
    lines.push("DOCKER_IMAGE_NAME=tsera-app");
    lines.push("");
  }

  // CI module
  if (modules.includes("ci")) {
    lines.push("# CI Configuration");
    lines.push("DEPLOY_TOKEN=CHANGE_ME_PROD_DEPLOY_TOKEN");
    lines.push("CI_REGISTRY=CHANGE_ME_PROD_REGISTRY");
    lines.push("");
  }

  lines.push("# Debugging (should be false in production)");
  lines.push("DEBUG=false");

  return lines.join("\n");
}

/**
 * Generates env.config.ts file with declarative schema definitions.
 *
 * @param config - Generation configuration.
 * @returns TypeScript code for env.config.ts.
 */
export function generateEnvSchema(config: EnvGenerationConfig): string {
  const { db, modules } = config;

  const lines: string[] = [
    "/**",
    " * Environment variable schema for this TSera project.",
    " *",
    " * This schema defines all environment variables required by the application,",
    " * their types, and in which environments they are required.",
    " *",
    " * TSera will validate these variables at startup and refuse to start if",
    " * any required variables are missing or invalid.",
    " *",
    " * Schema format:",
    ' * - type: "string" | "number" | "boolean" | "url" (REQUIRED)',
    ' * - required: true | false | ["env1", "env2"] (REQUIRED)',
    " *   - true: required in all environments",
    " *   - false: optional in all environments",
    ' *   - ["env1", "env2"]: required only in specified environments',
    " * - description: human-readable description (optional but recommended)",
    " */",
    "",
    "export default {",
  ];

  // Database variables
  lines.push("  // Database Configuration");
  lines.push("  DATABASE_URL: {");
  lines.push('    type: "url" as const,');
  lines.push("    required: true,");
  lines.push(`    description: "${getDbDescription(db.dialect)} connection URL",`);
  lines.push("  },");

  if (db.dialect === "postgres" || db.dialect === "mysql") {
    lines.push("  DATABASE_SSL: {");
    lines.push('    type: "string" as const,');
    lines.push('    required: ["dev", "staging"],');
    lines.push('    description: "SSL mode for database connection (disable, prefer, require)",');
    lines.push("  },");
  }

  // Hono variables
  if (modules.includes("hono")) {
    lines.push("");
    lines.push("  // API Server (Hono)");
    lines.push("  PORT: {");
    lines.push('    type: "number" as const,');
    lines.push("    required: false,");
    lines.push('    description: "API server port",');
    lines.push("  },");
    lines.push("  HOST: {");
    lines.push('    type: "string" as const,');
    lines.push("    required: false,");
    lines.push('    description: "API server host",');
    lines.push("  },");
    lines.push("  API_PREFIX: {");
    lines.push('    type: "string" as const,');
    lines.push("    required: false,");
    lines.push('    description: "API route prefix",');
    lines.push("  },");
  }

  // Lume variables
  if (modules.includes("lume")) {
    lines.push("");
    lines.push("  // Frontend Server (Lume)");
    lines.push("  LUME_PORT: {");
    lines.push('    type: "number" as const,');
    lines.push("    required: false,");
    lines.push('    description: "Lume frontend server port",');
    lines.push("  },");
  }

  // Docker variables
  if (modules.includes("docker")) {
    lines.push("");
    lines.push("  // Docker Configuration");
    lines.push("  DOCKER_REGISTRY: {");
    lines.push('    type: "string" as const,');
    lines.push('    required: ["staging", "prod"],');
    lines.push('    description: "Docker registry URL",');
    lines.push("  },");
    lines.push("  DOCKER_IMAGE_NAME: {");
    lines.push('    type: "string" as const,');
    lines.push("    required: false,");
    lines.push('    description: "Docker image name",');
    lines.push("  },");
  }

  // CI variables
  if (modules.includes("ci")) {
    lines.push("");
    lines.push("  // CI Configuration");
    lines.push("  DEPLOY_TOKEN: {");
    lines.push('    type: "string" as const,');
    lines.push('    required: ["staging", "prod"],');
    lines.push('    description: "Deployment authentication token",');
    lines.push("  },");
    lines.push("  CI_REGISTRY: {");
    lines.push('    type: "string" as const,');
    lines.push('    required: ["staging", "prod"],');
    lines.push('    description: "CI container registry",');
    lines.push("  },");
  }

  // Debug variable
  lines.push("");
  lines.push("  // Debugging");
  lines.push("  DEBUG: {");
  lines.push('    type: "boolean" as const,');
  lines.push("    required: false,");
  lines.push('    description: "Enable debug logging",');
  lines.push("  },");

  lines.push("} as const;");
  lines.push("");
  lines.push("/**");
  lines.push(" * Type definition for environment variable configuration.");
  lines.push(" */");
  lines.push("export type EnvKeyConfig = {");
  lines.push('  type: "string" | "number" | "boolean" | "url";');
  lines.push("  required: boolean | string[];");
  lines.push("  description?: string;");
  lines.push("};");
  lines.push("");
  lines.push("/**");
  lines.push(" * Type definition for * full environment schema.");
  lines.push(" */");
  lines.push("export type EnvSchema = Record<string, EnvKeyConfig>;");

  return lines.join("\n");
}

/**
 * Gets a human-readable description for a database dialect.
 */
function getDbDescription(dialect: DbConfig["dialect"]): string {
  switch (dialect) {
    case "postgres":
      return "PostgreSQL";
    case "mysql":
      return "MySQL";
    case "sqlite":
      return "SQLite";
    default:
      return "Database";
  }
}
