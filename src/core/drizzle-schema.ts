import type { EntityRuntime, FieldDef } from "./entity.ts";
import { filterStoredFields } from "./entity.ts";
import { pascalToSnakeCase } from "./utils/strings.ts";
import { getZodInternal, type ZodType } from "./utils/zod.ts";

export type Dialect = "postgres" | "sqlite" | "mysql";

/**
 * Extracts the Drizzle type from a Zod schema.
 *
 * @param zodSchema - Zod schema to analyze.
 * @param dialect - Target SQL dialect.
 * @returns Corresponding Drizzle type.
 */
function extractDrizzleTypeFromZod(zodSchema: ZodType, dialect: Dialect): string {
  const { def } = getZodInternal(zodSchema);

  // Handle ZodString
  if (def.type === "string") {
    return "text";
  }

  // Handle ZodNumber
  if (def.type === "number") {
    if (dialect === "mysql") {
      return "int";
    }
    return "integer";
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    if (dialect === "sqlite") {
      return "integer({ mode: 'boolean' })";
    }
    return "boolean";
  }

  // Handle ZodDate
  if (def.type === "date") {
    if (dialect === "postgres") {
      return "timestamp";
    }
    if (dialect === "mysql") {
      return "datetime";
    }
    return "text";
  }

  // Handle ZodArray
  if (def.type === "array") {
    if (dialect === "postgres") {
      return "jsonb";
    }
    if (dialect === "mysql") {
      return "json";
    }
    return "text";
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    if (dialect === "postgres") {
      return "jsonb";
    }
    if (dialect === "mysql") {
      return "json";
    }
    return "text";
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    if (def.innerType) {
      return extractDrizzleTypeFromZod(def.innerType, dialect);
    }
  }

  // Handle ZodDefault
  if (def.type === "default") {
    if (def.innerType) {
      return extractDrizzleTypeFromZod(def.innerType, dialect);
    }
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    if (def.innerType) {
      return extractDrizzleTypeFromZod(def.innerType, dialect);
    }
  }

  // Fallback
  return "text";
}

/**
 * Generates a Drizzle ORM table definition (TypeScript code) for the provided entity.
 * STRICTLY FILTERS: only generates fields where stored === true.
 *
 * @param entity - TSERA entity runtime.
 * @param dialect - SQL dialect (default: postgres).
 * @returns TypeScript code defining the table.
 */
export function entityToDrizzleTable(
  entity: EntityRuntime,
  dialect: Dialect = "postgres",
): string {
  if (!entity.table) {
    return `// Entity ${entity.name} is not mapped to a table.`;
  }

  // STRICTLY FILTER: only keep fields where stored === true
  const storedFields = filterStoredFields(entity.fields);

  if (Object.keys(storedFields).length === 0) {
    return `// Entity ${entity.name} has no stored fields.`;
  }

  const tableName = pascalToSnakeCase(entity.name);
  const variableName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);

  const imports = getImports(dialect);

  // Extract the shape from the Zod schema
  const schemaDef = getZodInternal(entity.schema).def;
  if (schemaDef.type !== "object") {
    throw new Error(`Entity ${entity.name} schema is not a ZodObject`);
  }

  const shape = schemaDef.shape;
  if (!shape) {
    throw new Error(`Entity ${entity.name} schema has no shape`);
  }
  const columns: string[] = [];

  for (const [name, field] of Object.entries(storedFields)) {
    const zodSchema = shape[name] as ZodType;
    if (!zodSchema) {
      continue;
    }
    columns.push(formatColumn(name, field, zodSchema, dialect));
  }

  if (columns.length === 0) {
    return `// Entity ${entity.name} has no valid stored fields.`;
  }

  return `${imports}

export const ${variableName} = ${getTableFunction(dialect)}("${tableName}", {
  ${columns.join(",\n  ")}
});
`;
}

function getImports(dialect: Dialect): string {
  switch (dialect) {
    case "postgres":
      return `import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";`;
    case "mysql":
      return `import { mysqlTable, text, int, boolean, datetime, json } from "drizzle-orm/mysql-core";`;
    case "sqlite":
      return `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";`;
  }
}

function getTableFunction(dialect: Dialect): string {
  switch (dialect) {
    case "postgres":
      return "pgTable";
    case "mysql":
      return "mysqlTable";
    case "sqlite":
      return "sqliteTable";
  }
}

function formatColumn(name: string, field: FieldDef, zodSchema: ZodType, dialect: Dialect): string {
  let def = extractDrizzleTypeFromZod(zodSchema, dialect);

  def = `${def}("${name}")`;

  // NOT NULL if field is not nullable and not optional
  const { def: zodDef } = getZodInternal(zodSchema);
  const isOptional = zodDef.type === "optional";
  const innerDef = zodDef.innerType ? getZodInternal(zodDef.innerType).def : null;
  const isNullable = zodDef.type === "nullable" ||
    (isOptional && innerDef?.type === "nullable");

  if (!isOptional && !isNullable) {
    def += ".notNull()";
  }

  // PRIMARY KEY
  if (field.db?.primary === true) {
    def += ".primaryKey()";
  }

  // UNIQUE
  if (field.db?.unique === true) {
    def += ".unique()";
  }

  // DEFAULT
  if (field.db?.defaultNow === true) {
    if (dialect === "postgres") {
      def += ".defaultNow()";
    } else if (dialect === "mysql") {
      def += ".default(sql\`CURRENT_TIMESTAMP\`)";
    } else {
      def += ".default(sql\`datetime('now')\`)";
    }
  } else {
    // Check if Zod schema has a default
    if (zodDef.type === "default") {
      const defaultValue = zodDef.defaultValue;
      if (defaultValue !== undefined) {
        if (typeof defaultValue === "string") {
          def += `.default(${JSON.stringify(defaultValue)})`;
        } else if (typeof defaultValue === "number" || typeof defaultValue === "boolean") {
          def += `.default(${String(defaultValue)})`;
        } else {
          def += `.default(${JSON.stringify(defaultValue)})`;
        }
      }
    }
  }

  return `${name}: ${def}`;
}
