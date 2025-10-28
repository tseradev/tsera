import type { EntityDef, TColumn, TPrimitive } from "./entity.ts";
import { isArrayColumnType } from "./entity.ts";
import { entityToZod } from "./schema.ts";

export interface OpenAPIDocumentOptions {
  title: string;
  version: string;
  description?: string;
}

export interface SchemaObject {
  type?: string | string[];
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  nullable?: boolean;
  default?: unknown;
  items?: SchemaObject;
  format?: string;
  additionalProperties?: boolean;
}

export interface OpenAPIObject {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, SchemaObject>;
  };
}

function primitiveToSchema(type: TPrimitive): SchemaObject {
  switch (type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date-time" };
    case "json":
      return {
        type: [
          "object",
          "array",
          "string",
          "number",
          "boolean",
          "null",
        ],
      };
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported primitive type: ${exhaustiveCheck}`);
    }
  }
}

function columnToSchema(column: TColumn): SchemaObject {
  const base = isArrayColumnType(column.type)
    ? {
      type: "array" as const,
      items: primitiveToSchema(column.type.arrayOf),
    }
    : primitiveToSchema(column.type);

  const schema: SchemaObject = { ...base };

  if (column.description) {
    schema.description = column.description;
  }
  if (column.nullable) {
    schema.nullable = true;
  }
  if (column.default !== undefined) {
    schema.default = column.default;
  }
  if (!isArrayColumnType(column.type) && column.type === "json") {
    schema.additionalProperties = true;
  }

  return schema;
}

function entityToSchema(entity: EntityDef): SchemaObject {
  const zodSchema = entityToZod(entity);
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (const [name, column] of Object.entries(entity.columns)) {
    properties[name] = columnToSchema(column);
    if (!column.optional) {
      required.push(name);
    }
  }

  const schema: SchemaObject = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  if (zodSchema.description ?? entity.doc) {
    schema.description = zodSchema.description ?? `${entity.name} entity`;
  }

  return schema;
}

export function generateOpenAPIDocument(
  entities: readonly EntityDef[],
  options: OpenAPIDocumentOptions,
): OpenAPIObject {
  const schemas: Record<string, SchemaObject> = {};
  for (const entity of entities) {
    schemas[entity.name] = entityToSchema(entity);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths: {},
    components: { schemas },
  };
}
