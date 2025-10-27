import type { EntityDef, TPrimitive } from "./entity.ts";
import { isArrayColumnType } from "./entity.ts";

export interface OpenAPIOptions {
  title: string;
  version: string;
  description?: string;
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
    schemas: Record<string, OpenAPISchema>;
  };
}

export interface OpenAPISchema {
  type: string;
  description?: string;
  properties?: Record<string, OpenAPIProperty>;
  required?: string[];
}

export interface OpenAPIProperty {
  type: string;
  format?: string;
  nullable?: boolean;
  description?: string;
  default?: unknown;
  items?: OpenAPIProperty;
}

export function entityToOpenAPI(entity: EntityDef, options: OpenAPIOptions): OpenAPIObject {
  const properties: Record<string, OpenAPIProperty> = {};
  const required: string[] = [];

  for (const [name, column] of Object.entries(entity.columns)) {
    const property = mapColumnToProperty(column);
    if (!column.optional && !column.nullable && column.default === undefined) {
      required.push(name);
    }
    properties[name] = property;
  }

  const schema: OpenAPISchema = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  if (entity.doc) {
    schema.description = `${entity.name} entity`;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths: {},
    components: {
      schemas: {
        [entity.name]: schema,
      },
    },
  };
}

function mapColumnToProperty(column: EntityDef["columns"][string]): OpenAPIProperty {
  if (isArrayColumnType(column.type)) {
    const property: OpenAPIProperty = {
      type: "array",
      items: primitiveToProperty(column.type.arrayOf),
    };

    if (column.nullable) {
      property.nullable = true;
    }
    if (column.description) {
      property.description = column.description;
    }
    if (column.default !== undefined) {
      property.default = column.default;
    }

    return property;
  }

  const property = primitiveToProperty(column.type);
  if (column.nullable) {
    property.nullable = true;
  }
  if (column.description) {
    property.description = column.description;
  }
  if (column.default !== undefined) {
    property.default = column.default;
  }
  return property;
}

function primitiveToProperty(type: TPrimitive): OpenAPIProperty {
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
      return { type: "object" };
    default:
      throw new Error(`Unsupported primitive type: ${String(type)}`);
  }
}
