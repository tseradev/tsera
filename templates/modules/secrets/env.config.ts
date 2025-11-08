/**
 * Environment variable schema for this TSera project.
 *
 * This schema defines all environment variables required by the application,
 * their types, and whether they're required.
 *
 * This file is a template placeholder. It will be replaced with a complete
 * schema during project initialization based on the selected modules and
 * database configuration.
 *
 * @module
 */

import { defineEnvSchema } from "tsera/core/secrets.ts";

/**
 * Environment variable schema.
 *
 * This is a minimal template schema. The actual schema will be generated
 * during project initialization with all required variables based on
 * enabled modules and database configuration.
 */
export const envSchema = defineEnvSchema({
  // Template placeholder - will be replaced during init
  DATABASE_URL: {
    type: "string",
    required: true,
    description: "Database connection URL",
  },
});

