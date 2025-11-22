/**
 * OpenAPI document generation from entity definitions.
 *
 * This module provides functionality to generate OpenAPI 3.1.0 documents
 * from TSera entity definitions.
 *
 * @module
 */

import type { EntityRuntime } from "./entity.ts";
import type { ZodType } from "./utils/zod.ts";

/**
 * Internal Zod definition structure (for accessing _zod.def).
 * This is used to access Zod's internal API which is not part of the public types.
 */
interface ZodInternalDef {
  type: string;
  checks?: Array<{ def?: { format?: string } }>;
  element?: ZodType;
  innerType?: ZodType;
  defaultValue?: unknown;
  shape?: Record<string, ZodType>;
}

/**
 * Helper type for accessing Zod's internal _zod property.
 * Uses unknown instead of any for type safety.
 */
type ZodWithInternal = {
  _zod: {
    def: ZodInternalDef;
  };
  description?: string;
} & ZodType;

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
  /** API paths (includes actions if configured). */
  paths: Record<string, unknown>;
  /** OpenAPI components including schemas. */
  components: {
    /** Schema definitions keyed by schema name. */
    schemas: Record<string, SchemaObject>;
  };
}

/**
 * Converts a Zod schema to an OpenAPI schema object.
 * This is a simplified conversion that handles basic Zod types.
 *
 * @param zodSchema - Zod schema to convert.
 * @returns OpenAPI schema object.
 */
function zodSchemaToOpenAPI(zodSchema: ZodType): SchemaObject {
  const zodWithInternal = zodSchema as unknown as ZodWithInternal;
  const def = zodWithInternal._zod.def;

  // Handle ZodString
  if (def.type === "string") {
    const schema: SchemaObject = { type: "string" };
    if (zodWithInternal.description) {
      schema.description = zodWithInternal.description;
    }
    // Check for format (email, uuid, etc.)
    if (def.checks) {
      for (const check of def.checks) {
        const checkDef = check.def;
        if (checkDef?.format === "email") {
          schema.format = "email";
        } else if (checkDef?.format === "uuid") {
          schema.format = "uuid";
        }
      }
    }
    return schema;
  }

  // Handle ZodNumber
  if (def.type === "number") {
    const schema: SchemaObject = { type: "number" };
    if (zodSchema.description) {
      schema.description = zodSchema.description;
    }
    return schema;
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    const schema: SchemaObject = { type: "boolean" };
    if (zodSchema.description) {
      schema.description = zodSchema.description;
    }
    return schema;
  }

  // Handle ZodDate
  if (def.type === "date") {
    const schema: SchemaObject = { type: "string", format: "date-time" };
    if (zodSchema.description) {
      schema.description = zodSchema.description;
    }
    return schema;
  }

  // Handle ZodArray
  if (def.type === "array") {
    const schema: SchemaObject = {
      type: "array",
      items: zodSchemaToOpenAPI(def.element as ZodType),
    };
    if (zodSchema.description) {
      schema.description = zodSchema.description;
    }
    return schema;
  }

  // Handle ZodObject
  if (def.type === "object") {
    const shape = def.shape;
    if (!shape) {
      return { type: "object", properties: {} };
    }
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = zodSchemaToOpenAPI(value as ZodType);
      properties[key] = fieldSchema;

      // Check if field is required (not optional)
      const fieldWithInternal = value as unknown as ZodWithInternal;
      const fieldDef = fieldWithInternal._zod.def;
      if (fieldDef.type !== "optional" && fieldDef.type !== "default") {
        required.push(key);
      }
    }

    const schema: SchemaObject = {
      type: "object",
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    if (zodSchema.description) {
      schema.description = zodSchema.description;
    }

    return schema;
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    return zodSchemaToOpenAPI(def.innerType as ZodType);
  }

  // Handle ZodDefault
  if (def.type === "default") {
    const schema = zodSchemaToOpenAPI(def.innerType as ZodType);
    schema.default = def.defaultValue;
    return schema;
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    const schema = zodSchemaToOpenAPI(def.innerType as ZodType);
    schema.nullable = true;
    return schema;
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    return {
      type: ["object", "array", "string", "number", "boolean", "null"],
      additionalProperties: true,
    };
  }

  // Fallback for unknown types
  return {
    type: "object",
    description: "Unknown Zod type",
  };
}

/**
 * Converts an entity runtime to an OpenAPI schema object.
 * Uses entity.public (already filtered with visibility === "public").
 *
 * @param entity - TSERA entity runtime.
 * @returns OpenAPI schema object representing the entity.
 */
function entityToSchema(entity: EntityRuntime): SchemaObject {
  // Use entity.public (already filtered with visibility === "public")
  const schema = zodSchemaToOpenAPI(entity.public);

  // Add description from entity.openapi or entity.docs
  if (entity.openapi?.description) {
    schema.description = entity.openapi.description;
  } else if (entity.docs?.description) {
    schema.description = entity.docs.description;
  } else if (!schema.description) {
    schema.description = `${entity.name} entity`;
  }

  return schema;
}

/**
 * Generates an OpenAPI 3.1.0 document from a collection of entity runtimes.
 * Uses only entity.public for schemas (visibility filtering).
 *
 * @param entities - Array of entity runtimes to include in the document.
 * @param options - Configuration options for the OpenAPI document (title, version, description).
 * @returns A complete OpenAPI document object with schemas derived from the entities.
 */
export function generateOpenAPIDocument(
  entities: readonly EntityRuntime[],
  options: OpenAPIDocumentOptions,
): OpenAPIObject {
  const schemas: Record<string, SchemaObject> = {};
  const paths: Record<string, unknown> = {};

  for (const entity of entities) {
    // Only generate if openapi.enabled !== false
    if (entity.openapi?.enabled === false) {
      continue;
    }

    // Generate schema from entity.public (already filtered)
    schemas[entity.name] = entityToSchema(entity);

    // Generate paths from entity.actions if available
    if (entity.actions) {
      // TODO: Implement path generation from actions
      // For now, leave empty
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths,
    components: { schemas },
  };
}
