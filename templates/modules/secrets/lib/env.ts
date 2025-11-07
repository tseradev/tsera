/**
 * Environment management module for the TSera project.
 * 
 * This module provides convenient access to validated environment variables
 * based on the schema defined in env.config.ts.
 * 
 * @module
 */

export {
  createEnv,
  type Environment,
  type EnvSchema,
  type EnvVarDefinition,
  getEnv,
  type TypedEnv,
  validateEnv,
  type ValidationResult,
} from "tsera/core/secrets.ts";

