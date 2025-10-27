/**
 * Core entity definition primitives for TSera.
 *
 * The current implementation intentionally keeps runtime guarantees minimal while
 * providing a stable contract for upcoming work. Additional validation powered by
 * Zod will arrive in later milestones.
 */

export type TPrimitive = "string" | "number" | "boolean" | "date" | "json";

export type TColumn = {
  type: TPrimitive | { arrayOf: TPrimitive };
  optional?: boolean;
  nullable?: boolean;
  default?: unknown;
  description?: string;
};

export interface EntitySpec {
  name: string;
  table?: boolean;
  columns: Record<string, TColumn>;
  doc?: boolean;
  test?: "smoke" | false;
}

export type EntityDef = Readonly<EntitySpec> & { __brand: "TSeraEntity" };

/**
 * Freeze the provided specification to preserve immutability expectations and
 * attach a nominal brand so downstream helpers can discriminate TSera entities
 * from plain objects.
 */
export function defineEntity(spec: EntitySpec): EntityDef {
  const normalized: EntitySpec = {
    table: false,
    doc: false,
    test: "smoke",
    ...spec,
  };
  return Object.freeze({ ...normalized, __brand: "TSeraEntity" });
}
