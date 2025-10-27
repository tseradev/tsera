import { EntityDef, isArrayColumnType, TColumn, TPrimitive } from "./entity.ts";
import { z, type ZodObject, type ZodTypeAny } from "./utils/zod.ts";

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

export function entityToZod(entity: EntityDef): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [name, column] of Object.entries(entity.columns)) {
    shape[name] = columnToSchema(column);
  }

  return z.object(shape).strict();
}
