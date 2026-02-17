import type { EntityRuntime } from "./entity.ts";
import type { ZodObject, ZodType } from "./utils/zod.ts";

/**
 * Returns the main Zod schema for an entity.
 *
 * @param entity - TSera runtime entity.
 * @returns Main Zod schema.
 */
export function getEntitySchema(entity: EntityRuntime): ZodObject<Record<string, ZodType>> {
  return entity.schema;
}

/**
 * Returns the public schema for an entity (fields with visibility === "public").
 *
 * @param entity - TSera runtime entity.
 * @returns Public Zod schema.
 */
export function getEntityPublicSchema(entity: EntityRuntime): ZodObject<Record<string, ZodType>> {
  return entity.public;
}

/**
 * Returns input schemas for an entity (create and update).
 *
 * @param entity - TSera runtime entity.
 * @returns Input schemas (create and update).
 */
export function getEntityInputSchemas(entity: EntityRuntime): {
  create: ZodObject<Record<string, ZodType>>;
  update: ZodObject<Record<string, ZodType>>;
} {
  return entity.input;
}
