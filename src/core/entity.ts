import { z } from "./utils/zod.ts";
import { deepFreeze } from "./utils/object.ts";
import { isPascalCase } from "./utils/strings.ts";

/**
 * Primitive column types supported by TSera entities.
 */
export type TPrimitive = "string" | "number" | "boolean" | "date" | "json";

/**
 * Configuration for array-based columns where each element shares the same primitive type.
 */
export type TArrayColumn = { arrayOf: TPrimitive };

/**
 * Declarative description of a single column on an entity definition.
 */
export type TColumn = {
  /** Primitive or array column type. */
  type: TPrimitive | TArrayColumn;
  /** Marks the column as optional, meaning it may be omitted entirely. */
  optional?: boolean;
  /** Marks the column as nullable, allowing {@code null} values. */
  nullable?: boolean;
  /** Default value applied during schema generation when no explicit value is provided. */
  default?: unknown;
  /** Human-readable description surfaced in generated schemas. */
  description?: string;
};

/**
 * Specification used to declare an entity before runtime validation.
 */
export interface EntitySpec {
  /** PascalCase name for the entity. */
  name: string;
  /** Indicates whether a relational table should be generated for the entity. */
  table?: boolean;
  /** Map of column names to their configuration. */
  columns: Record<string, TColumn>;
  /** Enables documentation generation for the entity. */
  doc?: boolean;
  /** Configures smoke-test generation behaviour. */
  test?: "smoke" | false;
}

/**
 * Immutable runtime representation of an entity produced by {@link defineEntity}.
 */
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
  columns: z.record(z.string(), columnSchema).refine((columns) => Object.keys(columns).length > 0, {
    message: "Entity must define at least one column",
  }),
  doc: z.boolean().optional(),
  test: z.union([z.literal("smoke"), z.literal(false)]).optional(),
}).strict();

/**
 * Validates an {@link EntitySpec}, freezing the resulting object to ensure immutability
 * and returning a branded {@link EntityDef} for downstream consumers.
 *
 * @param spec - Entity specification provided by the caller.
 * @returns A validated and deeply frozen entity definition.
 * @throws {SchemaError} If the specification fails schema validation.
 */
export function defineEntity(spec: EntitySpec): EntityDef {
  const parsed = entitySpecSchema.parse(spec);
  const frozen = deepFreeze({ ...parsed, __brand: "TSeraEntity" as const });
  return frozen as EntityDef;
}

/**
 * Type guard verifying whether the provided column type represents an array-based column.
 *
 * @param type - Column type definition to inspect.
 * @returns {@code true} if the type describes an array column; otherwise {@code false}.
 */
export function isArrayColumnType(type: TColumn["type"]): type is TArrayColumn {
  return typeof type === "object" && type !== null && "arrayOf" in type;
}
