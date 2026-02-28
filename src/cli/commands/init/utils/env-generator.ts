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
export type EnvGenerationConfig = {
  db: DbConfig;
  modules: string[];
};

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
    "# This file is loaded when DENO_ENV=dev (or by default)",
    "# Fill in all required values below before starting the application",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_PROVIDER=postgres");
    lines.push("DATABASE_URL=postgresql://localhost:5432/tsera_dev");
    lines.push("DATABASE_SSL=disable");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_PROVIDER=mysql");
    lines.push("DATABASE_URL=mysql://localhost:3306/tsera_dev");
    lines.push("DATABASE_SSL=false");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_PROVIDER=sqlite");
    lines.push("DATABASE_URL=file:./app/db/tsera_dev.db");
  }

  lines.push("");

  // Hono module
  if (modules.includes("hono")) {
    lines.push("# API Server (Hono)");
    lines.push("PORT=3001");
    lines.push("HOST=localhost");
    lines.push("API_PREFIX=/api");
    lines.push("");
  }

  // Lume module
  if (modules.includes("lume")) {
    lines.push("# Frontend Server (Lume)");
    lines.push("LUME_PORT=3000");
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

  // Environment identifier - DENO_ENV in this file determines the environment
  lines.push("# Environment");
  lines.push("DENO_ENV=dev");
  lines.push("");

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
    "# DENO_ENV=staging in this file determines the environment.",
    "# Fill in all required values below before starting the application",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_PROVIDER=postgres");
    lines.push("DATABASE_URL=postgresql://staging-host:5432/tsera_staging");
    lines.push("DATABASE_SSL=prefer");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_PROVIDER=mysql");
    lines.push("DATABASE_URL=mysql://staging-host:3306/tsera_staging");
    lines.push("DATABASE_SSL=true");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_PROVIDER=sqlite");
    lines.push("DATABASE_URL=file:./app/db/tsera_staging.db");
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

  // Environment identifier (source of truth for environment detection)
  lines.push("# Environment");
  lines.push("DENO_ENV=staging");
  lines.push("");

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
    "# DENO_ENV=prod in this file determines the environment.",
    "# ⚠️  IMPORTANT: Fill in all required values before deploying to production!",
    "",
    "# Database Configuration",
  ];

  // Database URL based on dialect
  if (db.dialect === "postgres") {
    lines.push("DATABASE_PROVIDER=postgres");
    lines.push("DATABASE_URL=CHANGE_ME_PROD_POSTGRESQL_URL");
    lines.push("DATABASE_SSL=require");
  } else if (db.dialect === "mysql") {
    lines.push("DATABASE_PROVIDER=mysql");
    lines.push("DATABASE_URL=CHANGE_ME_PROD_MYSQL_URL");
    lines.push("DATABASE_SSL=true");
  } else if (db.dialect === "sqlite") {
    lines.push("DATABASE_PROVIDER=sqlite");
    lines.push("DATABASE_URL=file:./app/db/tsera_prod.db");
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

  // Environment identifier (source of truth for environment detection)
  lines.push("# Environment");
  lines.push("DENO_ENV=prod");
  lines.push("");

  lines.push("# Debugging (should be false in production)");
  lines.push("DEBUG=false");

  return lines.join("\n");
}

/**
 * Generates env.config.ts file with EnvConfigSchema format.
 *
 * @param config - Generation configuration.
 * @returns TypeScript code for env.config.ts.
 */
export function generateEnvSchema(config: EnvGenerationConfig): string {
  const { db, modules } = config;

  const lines: string[] = [
    'import type { EnvConfigSchema } from "@tsera/core";',
    'import { z } from "zod";',
    "",
    "/**",
    " * Environment variable schema for this TSera project.",
    " * Each variable is defined with:",
    " * - `validator` - Zod schema for validation and type coercion",
    " * - `required` - Either `true` (always required), `false` (optional), or an array of environment names",
    " */",
    "",
    "const config: EnvConfigSchema = {",
  ];

  // Database variables
  lines.push("  // Database Configuration");
  lines.push("  DATABASE_PROVIDER: {");
  lines.push("    validator: z.string(),");
  lines.push("    required: true,");
  lines.push("  },");
  lines.push("  DATABASE_URL: {");
  lines.push("    validator: z.string().url(),");
  lines.push("    required: true,");
  lines.push("  },");

  if (db.dialect === "postgres" || db.dialect === "mysql") {
    lines.push("  DATABASE_SSL: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: false,");
    lines.push("  },");
  }

  // Hono variables
  if (modules.includes("hono")) {
    lines.push("");
    lines.push("  // API Server (Hono)");
    lines.push("  PORT: {");
    lines.push("    validator: z.coerce.number(),");
    lines.push("    required: true,");
    lines.push("  },");
    lines.push("  HOST: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: true,");
    lines.push("  },");
    lines.push("  API_PREFIX: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: true,");
    lines.push("  },");
  }

  // Lume variables
  if (modules.includes("lume")) {
    lines.push("");
    lines.push("  // Frontend Server (Lume)");
    lines.push("  LUME_PORT: {");
    lines.push("    validator: z.coerce.number(),");
    lines.push("    required: true,");
    lines.push("  },");
  }

  // Docker variables
  if (modules.includes("docker")) {
    lines.push("");
    lines.push("  // Docker Configuration");
    lines.push("  DOCKER_REGISTRY: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: false,");
    lines.push("  },");
    lines.push("  DOCKER_IMAGE_NAME: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: false,");
    lines.push("  },");
  }

  // CI variables
  if (modules.includes("ci")) {
    lines.push("");
    lines.push("  // CI Configuration");
    lines.push("  DEPLOY_TOKEN: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: false,");
    lines.push("  },");
    lines.push("  CI_REGISTRY: {");
    lines.push("    validator: z.string(),");
    lines.push("    required: false,");
    lines.push("  },");
  }

  // Environment and Debug variables
  lines.push("");
  lines.push("  // Environment");
  lines.push("  DENO_ENV: {");
  lines.push("    validator: z.string(),");
  lines.push("    required: true,");
  lines.push("  },");

  lines.push("");
  lines.push("  // Debugging");
  lines.push("  DEBUG: {");
  lines.push("    validator: z.coerce.boolean(),");
  lines.push("    required: true,");
  lines.push("  },");

  lines.push("};");
  lines.push("");
  lines.push("export default config;");

  return lines.join("\n");
}
