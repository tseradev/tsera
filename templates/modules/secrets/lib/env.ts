/**
 * Environment management initialization for the TSera project.
 *
 * This module initializes the secrets system and makes environment variables
 * available globally via the `tsera.env()` API.
 *
 * @module
 */

import { initializeSecrets } from "tsera/core/secrets.ts";
import { envSchema } from "../env.config.ts";

// Initialize the secrets system at startup
// This will:
// 1. Detect the current environment (via TSERA_ENV or default to 'dev')
// 2. Load the appropriate .env file from ./secrets/
// 3. Validate all variables according to the schema
// 4. Expose validated variables via tsera.env()
await initializeSecrets(envSchema, {
  secretsDir: "./secrets",
});

// Example usage:
// const dbUrl = tsera.env("DATABASE_URL");
// const port = tsera.env("PORT") as number;
// console.log(`Running in ${tsera.currentEnvironment} mode`);
