/**
 * Environment management initialization for the TSera project.
 *
 * This module initializes the secrets system and makes environment variables
 * available globally via the `tsera.env()` API.
 *
 * @module
 */

import { defineEnvSchema, initializeSecrets } from "tsera/core/secrets.ts";

/**
 * Environment variable schema.
 *
 * Defines all environment variables required by the application,
 * their types, and whether they're required.
 */
export const envSchema = defineEnvSchema({
  DATABASE_URL: {
    type: "string",
    required: true,
    description: "Database connection URL",
  },
  LUME_PORT: {
    type: "number",
    required: false,
    default: 8000,
    description: "Lume frontend server port",
  },
  PORT: {
    type: "number",
    required: false,
    default: 8000,
    description: "Backend server port",
  },
  DEBUG: {
    type: "boolean",
    required: false,
    default: false,
    description: "Enable debug mode",
  },
  LOG_LEVEL: {
    type: "string",
    required: false,
    default: "info",
    description: "Logging level (debug, info, warn, error)",
  },
});

// Initialize the secrets system at startup
// This will:
// 1. Detect the current environment (via TSERA_ENV or default to 'dev')
// 2. Load the appropriate .env file from ./config/secrets/
// 3. Validate all variables according to the schema
// 4. Expose validated variables via tsera.env()
await initializeSecrets(envSchema, {
  secretsDir: "./config/secrets",
});

// Example usage:
// const dbUrl = tsera.env("DATABASE_URL");
// const port = tsera.env("PORT") as number;
// console.log(`Running in ${tsera.currentEnvironment} mode`);
