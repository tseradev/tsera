import type { EntityDef } from "./entity.ts";
import type * as FallbackModule from "../deps/polyfills/drizzle.ts";

export type { Dialect } from "../deps/polyfills/drizzle.ts";

let fallbackModule: typeof FallbackModule | null = null;

try {
  await import("npm:drizzle-orm@0.30.10");
} catch {
  fallbackModule = await import("../deps/polyfills/drizzle.ts");
}

if (!fallbackModule) {
  fallbackModule = await import("../deps/polyfills/drizzle.ts");
}

/**
 * Converts an entity definition into a Data Definition Language (DDL) SQL statement
 * for the specified database dialect.
 *
 * @param entity - Validated entity definition to convert.
 * @param dialect - Target database dialect (defaults to "postgres").
 * @returns SQL DDL statement for creating the entity's table structure.
 */
export function entityToDDL(
  entity: EntityDef,
  dialect: FallbackModule.Dialect = "postgres",
): string {
  return fallbackModule!.entityToDDL(entity, dialect);
}
