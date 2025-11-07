import { defineEnvSchema } from "tsera/core/secrets.ts";

/**
 * Environment variable schema for this TSera project.
 * 
 * This schema defines all environment variables required by the application,
 * their types, and whether they're required in each environment.
 * 
 * TSera will validate these variables at startup and refuse to start if
 * any required variables are missing or invalid.
 */
export const envSchema = defineEnvSchema({
  TSERA_DATABASE_URL: {
    type: "string",
    required: true,
    description: "PostgreSQL connection URL",
    environments: ["dev", "preprod", "prod"],
  },
  PORT: {
    type: "number",
    required: false,
    default: 8000,
    description: "Server port",
  },
  DEBUG: {
    type: "boolean",
    required: false,
    default: false,
    description: "Enable debug logging",
    environments: ["dev"],
  },
  API_KEY: {
    type: "string",
    required: { dev: false, preprod: true, prod: true },
    description: "External API key for third-party services",
  },
});

export type Env = typeof envSchema;

