import type { EntityDef, TColumn, TPrimitive } from "../../core/entity.ts";
import { isArrayColumnType } from "../../core/entity.ts";
import { entityToZod } from "../../core/schema.ts";

/**
 * Options for generating an OpenAPI document.
 */
export interface OpenAPIDocumentOptions {
  /** Document title. */
  title: string;
  /** API version string. */
  version: string;
  /** Optional description. */
  description?: string;
}

/**
 * OpenAPI schema object representation.
 */
export interface SchemaObject {
  /** Type or array of types. */
  type?: string | string[];
  /** Human-readable description. */
  description?: string;
  /** Object properties (for object types). */
  properties?: Record<string, SchemaObject>;
  /** Required property names. */
  required?: string[];
  /** Whether the value can be null. */
  nullable?: boolean;
  /** Default value. */
  default?: unknown;
  /** Array item schema (for array types). */
  items?: SchemaObject;
  /** Format hint (e.g., "date-time"). */
  format?: string;
  /** Whether additional properties are allowed. */
  additionalProperties?: boolean;
}

/**
 * Complete OpenAPI document structure.
 */
export interface OpenAPIObject {
  /** OpenAPI specification version. */
  openapi: string;
  /** API information. */
  info: {
    /** API title. */
    title: string;
    /** API version. */
    version: string;
    /** Optional description. */
    description?: string;
  };
  /** API paths (currently empty in TSera). */
  paths: Record<string, unknown>;
  /** OpenAPI components including schemas. */
  components: {
    /** Schema definitions keyed by schema name. */
    schemas: Record<string, SchemaObject>;
  };
}

/**
 * Converts a primitive type to an OpenAPI schema object.
 *
 * @param type - Primitive type to convert.
 * @returns OpenAPI schema object.
 */
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
  }
}

/**
 * Converts a column definition to an OpenAPI schema object.
 *
 * @param column - Column definition to convert.
 * @returns OpenAPI schema object.
 */
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

/**
 * Converts an entity definition to an OpenAPI schema object.
 *
 * @param entity - Entity definition to convert.
 * @returns OpenAPI schema object representing the entity.
 */
function entityToSchema(entity: EntityDef): SchemaObject {
  const zodSchema = entityToZod(entity);
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (
    const [name, column] of Object.entries(entity.columns) as [
      string,
      TColumn,
    ][]
  ) {
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

/**
 * Generates a complete OpenAPI document from entity definitions.
 *
 * @param entities - Array of entity definitions to include.
 * @param options - OpenAPI document options.
 * @returns Complete OpenAPI document with schemas.
 */
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
