/**
 * Zod schema library utilities for TSera.
 *
 * This module provides centralized access to Zod functionality.
 *
 * @module
 */

import { z, ZodError } from "zod";
import type { ZodType } from "zod";

/**
 * Zod schema library instance.
 */
export { z };

/**
 * Error thrown when schema validation fails.
 */
export { ZodError as SchemaError };

/**
 * Internal Zod definition structure (for accessing _zod.def).
 * This is used to access Zod's internal API which is not part of public types.
 */
export type ZodInternalDef = {
  type: string;
  checks?: Array<{ def?: { format?: string; min?: number; max?: number } }>;
  element?: ZodType;
  innerType?: ZodType;
  defaultValue?: unknown;
  shape?: Record<string, ZodType>;
};

/**
 * Internal Zod schema wrapper with description and definition.
 */
export type ZodInternalSchema = {
  def: ZodInternalDef;
  description?: string;
};

/**
 * Safely extracts the internal Zod definition with runtime checks.
 *
 * @param schema - Zod schema to inspect.
 * @returns Internal Zod definition and optional description.
 * @throws Error if the schema does not expose internal definition data.
 */
export function getZodInternal(schema: ZodType): ZodInternalSchema {
  if (!isRecord(schema)) {
    throw new Error("Invalid Zod schema: missing internal definition.");
  }

  const zodInternal = schema["_zod"];
  if (!isRecord(zodInternal)) {
    throw new Error("Invalid Zod schema: missing internal definition.");
  }

  const defCandidate = zodInternal["def"];
  if (!isZodInternalDef(defCandidate)) {
    throw new Error("Invalid Zod schema: missing internal type.");
  }

  const description = typeof schema["description"] === "string" ? schema["description"] : undefined;

  return { def: defCandidate, description };
}

/**
 * Extracts the internal Zod definition only.
 *
 * @param schema - Zod schema to inspect.
 * @returns Internal Zod definition.
 */
export function getZodInternalDef(schema: ZodType): ZodInternalDef {
  return getZodInternal(schema).def;
}

export type { ZodError as SchemaErrorType, ZodObject, ZodType } from "zod";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isZodInternalDef(value: unknown): value is ZodInternalDef {
  return isRecord(value) && typeof value["type"] === "string";
}
