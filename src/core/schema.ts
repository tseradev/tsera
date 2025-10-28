import { EntityDef, isArrayColumnType, TColumn, TPrimitive } from "./entity.ts";
import { z, type ZodObject, type ZodTypeAny } from "./utils/zod.ts";

/**
 * Maps a primitive column type to its corresponding Zod schema implementation.
 *
 * @param type - Primitive column type to convert.
 * @returns Zod schema for the supplied primitive type.
 * @throws {Error} When the primitive type is not recognised.
 */
function primitiveToSchema(type: TPrimitive): ZodTypeAny {
  switch (type) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "date":
      return z.date();
    case "json":
      return z.any();
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported primitive type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Translates a full column configuration into a Zod schema, handling arrays, optionality,
 * nullability, default values, and descriptions.
 *
 * @param column - Column configuration to represent as a schema.
 * @returns Zod schema matching the column definition.
 */
function columnToSchema(column: TColumn): ZodTypeAny {
  const baseType = isArrayColumnType(column.type)
    ? z.array(primitiveToSchema(column.type.arrayOf))
    : primitiveToSchema(column.type);

  let schema = baseType;

  if (column.description) {
    schema = schema.describe(column.description);
  }

  if (column.nullable) {
    schema = schema.nullable();
  }

  if (column.optional) {
    schema = schema.optional();
  }

  if (column.default !== undefined) {
    schema = schema.default(column.default);
  }

  return schema;
}

/**
 * Generates a strict Zod object schema representing the provided entity definition.
 *
 * @param entity - Validated entity definition.
 * @returns A Zod object schema whose shape mirrors the entity columns.
 */
export function entityToZod(entity: EntityDef): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [name, column] of Object.entries(entity.columns)) {
    shape[name] = columnToSchema(column);
  }

  let schema = z.object(shape).strict();
  if (entity.doc) {
    schema = schema.describe(`${entity.name} entity`);
  }
  return schema;
}
