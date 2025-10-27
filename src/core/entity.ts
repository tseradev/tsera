import { z } from "./utils/zod.ts";
import { deepFreeze } from "./utils/object.ts";
import { isPascalCase } from "./utils/strings.ts";

export type TPrimitive = "string" | "number" | "boolean" | "date" | "json";
export type TArrayColumn = { arrayOf: TPrimitive };
export type TColumn = {
  type: TPrimitive | TArrayColumn;
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
export type EntityDef = Readonly<EntitySpec> & { readonly __brand: "TSeraEntity" };

const primitiveEnum = z.enum(["string", "number", "boolean", "date", "json"] as const);
const arrayColumnSchema = z.object({ arrayOf: primitiveEnum }).strict();
const columnSchema = z.object({
  type: z.union([primitiveEnum, arrayColumnSchema]),
  optional: z.boolean().optional(),
  nullable: z.boolean().optional(),
  default: z.unknown().optional(),
  description: z.string().min(1).optional(),
}).strict();

const entitySpecSchema = z.object({
  name: z.string().min(1).refine(isPascalCase, {
    message: "Entity name must be PascalCase",
  }),
  table: z.boolean().optional(),
  columns: z.record(columnSchema).refine((columns) => Object.keys(columns).length > 0, {
    message: "Entity must define at least one column",
  }),
  doc: z.boolean().optional(),
  test: z.union([z.literal("smoke"), z.literal(false)]).optional(),
}).strict();

export function defineEntity(spec: EntitySpec): EntityDef {
  const parsed = entitySpecSchema.parse(spec);
  const frozen = deepFreeze({ ...parsed, __brand: "TSeraEntity" as const });
  return frozen as EntityDef;
}

export function isArrayColumnType(type: TColumn["type"]): type is TArrayColumn {
  return typeof type === "object" && type !== null && "arrayOf" in type;
}
