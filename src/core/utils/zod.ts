/**
 * Zod schema library utilities for TSera.
 * 
 * This module provides centralized access to Zod functionality.
 * 
 * @module
 */

import { z, ZodError } from "zod";

/**
 * Zod schema library instance.
 */
export { z };

/**
 * Error thrown when schema validation fails.
 */
export { ZodError as SchemaError };

export type {
  ZodError as SchemaErrorType,
  ZodObject,
  ZodTypeAny,
} from "zod";
