import type { EntityRuntime } from "./entity.ts";
import type { ZodObject, ZodType } from "./utils/zod.ts";

/**
 * Retourne le schéma Zod principal d'une entité.
 *
 * @param entity - Entité runtime TSERA.
 * @returns Schéma Zod principal.
 */
export function getEntitySchema(entity: EntityRuntime): ZodObject<Record<string, ZodType>> {
  return entity.schema;
}

/**
 * Retourne le schéma public d'une entité (champs visibility === "public").
 *
 * @param entity - Entité runtime TSERA.
 * @returns Schéma Zod public.
 */
export function getEntityPublicSchema(entity: EntityRuntime): ZodObject<Record<string, ZodType>> {
  return entity.public;
}

/**
 * Retourne les schémas d'entrée d'une entité (create et update).
 *
 * @param entity - Entité runtime TSERA.
 * @returns Schémas d'entrée (create et update).
 */
export function getEntityInputSchemas(entity: EntityRuntime): {
  create: ZodObject<Record<string, ZodType>>;
  update: ZodObject<Record<string, ZodType>>;
} {
  return entity.input;
}
