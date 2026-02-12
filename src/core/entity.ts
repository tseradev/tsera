import { z, type ZodObject, type ZodType } from "./utils/zod.ts";
import { isPascalCase } from "./utils/strings.ts";
import { deepFreeze } from "./utils/object.ts";

/**
 * Field visibility level:
 * - "public"   : exposed in the API (User.public, OpenAPI, public docs)
 * - "internal" : not exposed in the API, used only on backend/DB side
 * - "secret"   : not exposed in the API AND masked in logs/docs/tests
 */
export type FieldVisibility = "public" | "internal" | "secret";

/**
 * Metadata specific to the DB / migrations layer.
 */
export type FieldDbMetadata = {
  /** Indicates if the field is a primary key. */
  primary?: boolean;
  /** Indicates if the field must be unique. */
  unique?: boolean;
  /** Indicates if the field must be indexed. */
  index?: boolean;
  /** Indicates if the field must have a default value (NOW()). */
  defaultNow?: boolean;
};

/**
 * Definition of a TSERA entity field.
 * Each field is defined by a Zod validator and metadata.
 */
export type FieldDef = {
  /**
   * Zod schema for this field (type + runtime constraints).
   * This is the base for all derived schemas (schema, input, public, etc.).
   */
  validator: ZodType;

  /**
   * Field visibility level:
   * - "public"   : exposed in the API (User.public, OpenAPI, public docs)
   * - "internal" : not exposed in the API, used only on backend/DB side
   * - "secret"   : not exposed in the API AND masked in logs/docs/tests
   *
   * Default: "public".
   */
  visibility?: FieldVisibility;

  /**
   * Field immutable after creation:
   * - true  : cannot be modified via update inputs
   * - false : modifiable normally
   *
   * Affects the generation of User.input.update and business logic.
   */
  immutable?: boolean;

  /**
   * Indicates if the field is physically stored in the database:
   * - true  : persisted column (default)
   * - false : logical/computed field, not persisted (but present in schemas)
   */
  stored?: boolean;

  /**
   * Functional description of the field.
   * Used for OpenAPI, generated docs, and potentially for frontend DX.
   */
  description?: string;

  /**
   * Example value.
   * Used for OpenAPI, generated docs, and test payload generation.
   */
  example?: unknown;

  /**
   * Metadata specific to the DB / migrations layer.
   */
  db?: FieldDbMetadata;
};

/**
 * Configuration for relations between entities.
 */
export type RelationsConfig = Record<string, unknown>;

/**
 * Configuration for actions (CRUD + custom).
 */
export type ActionsConfig = Record<string, unknown>;

/**
 * OpenAPI configuration for an entity.
 */
export type OpenAPIConfig = {
  /** Enables OpenAPI generation for this entity. */
  enabled?: boolean;
  /** OpenAPI tags for this entity. */
  tags?: string[];
  /** OpenAPI summary. */
  summary?: string;
  /** OpenAPI description. */
  description?: string;
};

/**
 * Documentation configuration for an entity.
 */
export type DocsConfig = {
  /** Functional description of the entity. */
  description?: string;
  /** Data examples. */
  examples?: Record<string, unknown>;
};

/**
 * Complete configuration for a TSERA entity.
 */
export type EntityConfig = {
  /** Logical name of the entity (PascalCase, required). */
  name: string;

  /** Indicates if a relational table should be generated for the entity. */
  table?: boolean;

  /** Enables generation of Zod schemas + types + OpenAPI. */
  schema?: boolean;

  /** Enables documentation generation (Markdown / site / CLI). */
  doc?: boolean;

  /** Configures test generation: false | "smoke" | "full". */
  test?: "smoke" | "full" | false;

  /** If false: entity is ignored by pipelines. */
  active?: boolean;

  /** Definition of the entity fields (required). */
  fields: Record<string, FieldDef>;

  /** Configuration for relations with other TSERA entities. */
  relations?: (r: unknown) => RelationsConfig;

  /** OpenAPI configuration. */
  openapi?: OpenAPIConfig;

  /** Documentation configuration. */
  docs?: DocsConfig;

  /** Configuration for actions (CRUD + custom). */
  actions?: (a: unknown) => ActionsConfig;
};

/**
 * Runtime for entity relations.
 */
export type RelationsRuntime = RelationsConfig;

/**
 * Runtime for entity actions.
 */
export type ActionsRuntime = ActionsConfig;

/**
 * TSERA runtime super-object for an entity.
 * Exposes all generated capabilities (schema, input, public, actions, relations).
 */
export type EntityRuntime = {
  /** Main Zod schema derived from fields.validator (all fields). */
  schema: ZodObject<Record<string, ZodType>>;

  /** Public schema (projection with fields where visibility === "public"). */
  public: ZodObject<Record<string, ZodType>>;

  /** Input schemas for creation and update. */
  input: {
    create: ZodObject<Record<string, ZodType>>;
    update: ZodObject<Record<string, ZodType>>;
  };

  /** CRUD + custom actions (if configured). */
  actions?: ActionsRuntime;

  /** Relations with other entities (if configured). */
  relations?: RelationsRuntime;

  /** Entity fields (exposed for metadata access). */
  fields: Record<string, FieldDef>;

  /** Entity metadata. */
  name: string;
  table?: boolean;
  schemaEnabled?: boolean;
  doc?: boolean;
  test?: "smoke" | "full" | false;
  active?: boolean;
  openapi?: OpenAPIConfig;
  docs?: DocsConfig;
} & { readonly __brand: "TSeraEntity" };

// ============================================================================
// Validation schemas
// ============================================================================

const fieldVisibilitySchema = z.enum(["public", "internal", "secret"]);

const fieldDbMetadataSchema = z.object({
  primary: z.boolean().optional(),
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
  defaultNow: z.boolean().optional(),
}).strict();

const fieldDefSchema: z.ZodType<FieldDef> = z.object({
  validator: z.any(), // ZodType - cannot be validated at runtime
  visibility: fieldVisibilitySchema.optional(),
  immutable: z.boolean().optional(),
  stored: z.boolean().optional(),
  description: z.string().min(1).optional(),
  example: z.unknown().optional(),
  db: fieldDbMetadataSchema.optional(),
}).strict();

const entityConfigSchema = z.object({
  name: z.string().min(1).refine(isPascalCase, {
    message: "Entity name must be PascalCase",
  }),
  table: z.boolean().optional(),
  schema: z.boolean().optional(),
  doc: z.boolean().optional(),
  test: z.union([z.literal("smoke"), z.literal("full"), z.literal(false)]).optional(),
  active: z.boolean().optional(),
  fields: z.record(z.string(), fieldDefSchema).refine((fields) => Object.keys(fields).length > 0, {
    message: "Entity must define at least one field",
  }),
  relations: z.function().optional(),
  openapi: z.object({
    enabled: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
  }).strict().optional(),
  docs: z.object({
    description: z.string().optional(),
    examples: z.record(z.string(), z.unknown()).optional(),
  }).strict().optional(),
  actions: z.function().optional(),
}).strict();

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Builds a Zod object schema from field validators.
 * Includes all fields, regardless of stored or visibility.
 */
function buildSchemaFromFields(
  fields: Record<string, FieldDef>,
): ZodObject<Record<string, ZodType>> {
  const shape: Record<string, ZodType> = {};
  for (const [name, field] of Object.entries(fields)) {
    let schema = field.validator;
    if (field.description) {
      schema = schema.describe(field.description);
    }
    shape[name] = schema;
  }
  return z.object(shape).strict();
}

/**
 * Builds the public schema by filtering fields with visibility === "public".
 */
function buildPublicSchema(
  baseSchema: ZodObject<Record<string, ZodType>>,
  fields: Record<string, FieldDef>,
): ZodObject<Record<string, ZodType>> {
  const publicKeys = Object.entries(fields)
    .filter(([, field]) => (field.visibility ?? "public") === "public")
    .map(([key]) => key);

  if (publicKeys.length === 0) {
    return z.object({}).strict();
  }

  return baseSchema.pick(
    publicKeys.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, true>),
  );
}

/**
 * Builds the input schema for creation.
 * Omits id, immutable fields, and auto-generated fields (createdAt, updatedAt if db.defaultNow).
 */
function buildInputCreateSchema(
  baseSchema: ZodObject<Record<string, ZodType>>,
  fields: Record<string, FieldDef>,
): ZodObject<Record<string, ZodType>> {
  const keysToOmit: string[] = [];

  // Omit id
  if ("id" in fields) {
    keysToOmit.push("id");
  }

  // Omit immutable fields
  for (const [key, field] of Object.entries(fields)) {
    if (field.immutable === true) {
      keysToOmit.push(key);
    }
  }

  // Omit auto-generated fields (createdAt, updatedAt if db.defaultNow)
  for (const [key, field] of Object.entries(fields)) {
    if (field.db?.defaultNow === true) {
      keysToOmit.push(key);
    }
  }

  if (keysToOmit.length === 0) {
    return baseSchema;
  }

  return baseSchema.omit(
    keysToOmit.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, true>),
  );
}

/**
 * Builds the input schema for update.
 * Partial + omit id, immutable fields, and auto-generated fields.
 */
function buildInputUpdateSchema(
  baseSchema: ZodObject<Record<string, ZodType>>,
  fields: Record<string, FieldDef>,
): ZodObject<Record<string, ZodType>> {
  const keysToOmit: string[] = [];

  // Omit id
  if ("id" in fields) {
    keysToOmit.push("id");
  }

  // Omit immutable fields
  for (const [key, field] of Object.entries(fields)) {
    if (field.immutable === true) {
      keysToOmit.push(key);
    }
  }

  // Omit auto-generated fields (createdAt, updatedAt if db.defaultNow)
  for (const [key, field] of Object.entries(fields)) {
    if (field.db?.defaultNow === true) {
      keysToOmit.push(key);
    }
  }

  let updateSchema = baseSchema.partial();

  if (keysToOmit.length > 0) {
    updateSchema = updateSchema.omit(
      keysToOmit.reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {} as Record<string, true>),
    );
  }

  return updateSchema;
}

/**
 * Generates default CRUD actions (structure, not implementation).
 */
function generateCRUDActions(_entity: EntityConfig): ActionsRuntime {
  return {
    create: { type: "create" },
    read: { type: "read" },
    update: { type: "update" },
    delete: { type: "delete" },
    list: { type: "list" },
  };
}

/**
 * Generates runtime relations from the configuration.
 */
function generateRelations(
  _entity: EntityConfig,
  relationsConfig?: RelationsConfig,
): RelationsRuntime | undefined {
  return relationsConfig;
}

/**
 * Filters fields to keep only those with stored === true.
 */
export function filterStoredFields(fields: Record<string, FieldDef>): Record<string, FieldDef> {
  const filtered: Record<string, FieldDef> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.stored !== false) {
      // stored: true (default) or undefined
      filtered[key] = field;
    }
  }
  return filtered;
}

/**
 * Filters fields to keep only those with visibility === "public".
 */
export function filterPublicFields(fields: Record<string, FieldDef>): Record<string, FieldDef> {
  const filtered: Record<string, FieldDef> = {};
  for (const [key, field] of Object.entries(fields)) {
    if ((field.visibility ?? "public") === "public") {
      filtered[key] = field;
    }
  }
  return filtered;
}

/**
 * Masks values of fields with visibility === "secret".
 */
export function maskSecretFields<T extends Record<string, unknown>>(
  data: T,
  fields: Record<string, FieldDef>,
): T {
  const masked = { ...data } as T;
  for (const [key, field] of Object.entries(fields)) {
    if (field.visibility === "secret" && key in masked) {
      (masked as Record<string, unknown>)[key] = "***";
    }
  }
  return masked;
}

// ============================================================================
// Main defineEntity function
// ============================================================================

/**
 * Validates an entity configuration and generates the TSERA runtime super-object.
 *
 * @param config - Entity configuration.
 * @returns Runtime super-object with all generated capabilities.
 * @throws {SchemaError} If the configuration fails validation.
 */
export function defineEntity(config: EntityConfig): EntityRuntime {
  // Validate the configuration
  const parsed = entityConfigSchema.parse(config) as EntityConfig;

  // Generate the main schema from validators
  const schema = buildSchemaFromFields(parsed.fields);

  // Generate the public schema (filter visibility === "public")
  const publicSchema = buildPublicSchema(schema, parsed.fields);

  // Generate input schemas
  const inputCreate = buildInputCreateSchema(schema, parsed.fields);
  const inputUpdate = buildInputUpdateSchema(schema, parsed.fields);

  // Generate CRUD actions if table: true and actions not provided
  let actions: ActionsRuntime | undefined;
  if (parsed.table === true && parsed.actions === undefined) {
    actions = generateCRUDActions(parsed);
  } else if (parsed.actions !== undefined) {
    // Call the actions function if provided
    const actionsFn = parsed.actions as (a: unknown) => ActionsConfig;
    actions = actionsFn({}) as ActionsRuntime;
  }

  // Generate relations if provided
  const relations = parsed.relations
    ? (() => {
      const relationsFn = parsed.relations as (r: unknown) => RelationsConfig;
      return generateRelations(parsed, relationsFn({}) as RelationsConfig);
    })()
    : undefined;

  // Build the runtime super-object
  const runtime: EntityRuntime = {
    schema,
    public: publicSchema,
    input: {
      create: inputCreate,
      update: inputUpdate,
    },
    actions,
    relations,
    fields: parsed.fields,
    name: parsed.name,
    table: parsed.table,
    schemaEnabled: parsed.schema,
    doc: parsed.doc,
    test: parsed.test,
    active: parsed.active,
    openapi: parsed.openapi,
    docs: parsed.docs,
    __brand: "TSeraEntity" as const,
  };

  // Freeze and return
  return deepFreeze(runtime) as EntityRuntime;
}
