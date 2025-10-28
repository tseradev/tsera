import type { EntityDef, TPrimitive } from "./entity.ts";
import { isArrayColumnType } from "./entity.ts";

/**
 * Options controlling the high-level metadata embedded in the generated OpenAPI document.
 */
export interface OpenAPIOptions {
  /** Title displayed in the OpenAPI info block. */
  title: string;
  /** Semantic version of the document. */
  version: string;
  /** Optional description for the API. */
  description?: string;
}

/**
 * Minimal OpenAPI document structure used by TSera.
 */
export interface OpenAPIObject {
  /** OpenAPI specification version. */
  openapi: string;
  /** Metadata describing the API. */
  info: {
    title: string;
    version: string;
    description?: string;
  };
  /** Placeholder for path definitions (empty in the MVP). */
  paths: Record<string, unknown>;
  /** Components container storing generated schemas. */
  components: {
    schemas: Record<string, OpenAPISchema>;
  };
}

/**
 * Object schema representation inserted into the OpenAPI components registry.
 */
export interface OpenAPISchema {
  /** JSON schema type. */
  type: string;
  /** Optional description shown in documentation. */
  description?: string;
  /** Column properties keyed by column name. */
  properties?: Record<string, OpenAPIProperty>;
  /** List of required property names. */
  required?: string[];
}

/**
 * Representation of a single property inside an OpenAPI schema.
 */
export interface OpenAPIProperty {
  /** JSON schema type for the property. */
  type: string;
  /** Optional format hint (used for date-time values). */
  format?: string;
  /** Whether the property accepts {@code null}. */
  nullable?: boolean;
  /** Human-readable description of the property. */
  description?: string;
  /** Default value serialised for documentation. */
  default?: unknown;
  /** Nested property definition used for arrays. */
  items?: OpenAPIProperty;
}

/**
 * Converts an {@link EntityDef} into an {@link OpenAPIObject}, mapping each column to
 * an OpenAPI schema property while respecting optionality and default values.
 *
 * @param entity - Validated entity definition to document.
 * @param options - Metadata describing the resulting document.
 * @returns An OpenAPI document containing a schema for the provided entity.
 */
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

/**
 * Maps a column definition to an OpenAPI property configuration, handling arrays and
 * primitive types uniformly.
 *
 * @param column - Column configuration extracted from the entity.
 * @returns An OpenAPI property definition for the column.
 */
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

/**
 * Creates an OpenAPI property definition for a primitive column type.
 *
 * @param type - Primitive column type to convert.
 * @returns OpenAPI property metadata matching the primitive type.
 */
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
