/**
 * Environment variable schema for this TSera project.
 *
 * This schema defines all environment variables required by application,
 * their types, and in which environments they are required.
 *
 * TSera will validate these variables at startup and refuse to start if
 * any required variables are missing or invalid.
 *
 * Schema format:
 * - type: "string" | "number" | "boolean" | "url" (REQUIRED)
 * - required: true | false | ["env1", "env2"] (REQUIRED)
 *   - true: required in all environments
 *   - false: optional in all environments
 *   - ["env1", "env2"]: required only in specified environments
 * - description: human-readable description (optional but recommended)
 */

// NOTE: Cet import relatif pointe vers le code source du CLI TSera.
// Dans un projet généré, cet import sera remplacé par un import JSR
import { defineEnvConfig } from "../../../src/core/secrets.ts";

export default defineEnvConfig({
  // Database Configuration
  DATABASE_URL: {
    type: "url",
    required: ["staging", "prod"],
    description: "Database connection URL",
  },
  DATABASE_SSL: {
    type: "string",
    required: false,
    description: "SSL mode for database connection (disable, prefer, require)",
  },

  // API Server (Hono)
  PORT: {
    type: "number",
    required: false,
    description: "API server port",
  },
  HOST: {
    type: "string",
    required: false,
    description: "API server host",
  },
  API_PREFIX: {
    type: "string",
    required: false,
    description: "API route prefix",
  },

  // Frontend Server (Lume)
  LUME_PORT: {
    type: "number",
    required: false,
    description: "Lume frontend server port",
  },

  // Debugging
  DEBUG: {
    type: "boolean",
    required: false,
    description: "Enable debug logging",
  },
});
