import type { EnvConfigSchema } from "@tsera/core";
import { z } from "zod";

/**
 * Environment variable schema for this TSera project.
 * Each variable is defined with:
 * - `validator` - Zod schema for validation and type coercion
 * - `required` - Either `true` (always required), `false` (optional), or an array of environment names
 */

const config: EnvConfigSchema = {
  // Database Configuration
  DATABASE_PROVIDER: {
    validator: z.string(),
    required: true,
  },
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
  DATABASE_SSL: {
    validator: z.string(),
    required: false,
  },

  // API Server (Hono)
  PORT: {
    validator: z.coerce.number(),
    required: true,
  },
  HOST: {
    validator: z.string(),
    required: true,
  },
  API_PREFIX: {
    validator: z.string(),
    required: true,
  },

  // Frontend Server (Lume)
  LUME_PORT: {
    validator: z.coerce.number(),
    required: true,
  },

  // Environment
  DENO_ENV: {
    validator: z.string(),
    required: true,
  },

  // Debugging
  DEBUG: {
    validator: z.coerce.boolean(),
    required: true,
  },
};

export default config;
