import type { EntityRuntime, FieldDef } from "./entity.ts";
import { filterStoredFields } from "./entity.ts";
import { pascalToSnakeCase } from "./utils/strings.ts";
import { getZodInternal, type ZodType } from "./utils/zod.ts";

/** Supported SQL dialect identifiers for DDL generation. */
export type Dialect = "postgres" | "sqlite" | "mysql";

/**
 * Extracts the SQL type from a Zod schema.
 * This function analyzes the Zod schema to determine the corresponding SQL type.
 *
 * @param zodSchema - Zod schema to analyze.
 * @param dialect - Target SQL dialect.
 * @returns Corresponding SQL type.
 */
function extractSqlTypeFromZod(zodSchema: ZodType, dialect: Dialect): string {
  const { def } = getZodInternal(zodSchema);

  // Handle ZodString
  if (def.type === "string") {
    return "TEXT";
  }

  // Handle ZodNumber
  if (def.type === "number") {
    if (dialect === "mysql") {
      return "INT";
    }
    return "INTEGER";
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    if (dialect === "postgres") {
      return "BOOLEAN";
    }
    if (dialect === "mysql") {
      return "TINYINT(1)";
    }
    return "INTEGER";
  }

  // Handle ZodDate
  if (def.type === "date") {
    if (dialect === "postgres") {
      return "TIMESTAMP";
    }
    if (dialect === "mysql") {
      return "DATETIME";
    }
    return "TEXT";
  }

  // Handle ZodArray
  if (def.type === "array") {
    if (dialect === "postgres") {
      return "JSONB";
    }
    if (dialect === "mysql") {
      return "JSON";
    }
    return "TEXT";
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    if (dialect === "postgres") {
      return "JSONB";
    }
    if (dialect === "mysql") {
      return "JSON";
    }
    return "TEXT";
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    if (def.innerType) {
      return extractSqlTypeFromZod(def.innerType, dialect);
    }
  }

  // Handle ZodDefault
  if (def.type === "default") {
    if (def.innerType) {
      return extractSqlTypeFromZod(def.innerType, dialect);
    }
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    if (def.innerType) {
      return extractSqlTypeFromZod(def.innerType, dialect);
    }
  }

  // Fallback
  return "TEXT";
}

/**
 * Formats a column definition for inclusion in CREATE TABLE.
 * Uses db metadata from field.db.
 *
 * @param name - Column name.
 * @param field - Field definition with metadata.
 * @param zodSchema - Corresponding Zod schema.
 * @param dialect - SQL dialect.
 * @returns SQL column definition.
 */
function formatColumn(
  name: string,
  field: FieldDef,
  zodSchema: ZodType,
  dialect: Dialect,
): string {
  const columnName = `  "${name}"`;
  const sqlType = extractSqlTypeFromZod(zodSchema, dialect);
  const constraints: string[] = [];

  // NOT NULL if field is not nullable and not optional and has no default
  const { def } = getZodInternal(zodSchema);
  const isOptional = def.type === "optional";
  const innerDef = def.innerType ? getZodInternal(def.innerType).def : null;
  const hasDefault = def.type === "default" || innerDef?.type === "default";
  const isNullable = def.type === "nullable" ||
    (isOptional && innerDef?.type === "nullable");

  if (!isOptional && !isNullable && !hasDefault) {
    constraints.push("NOT NULL");
  }

  // PRIMARY KEY
  if (field.db?.primary === true) {
    constraints.push("PRIMARY KEY");
  }

  // UNIQUE
  if (field.db?.unique === true) {
    constraints.push("UNIQUE");
  }

  // DEFAULT
  if (field.db?.defaultNow === true) {
    if (dialect === "postgres" || dialect === "mysql") {
      constraints.push("DEFAULT CURRENT_TIMESTAMP");
    } else {
      constraints.push("DEFAULT (datetime('now'))");
    }
  } else {
    // Check if Zod schema has a default
    if (def.type === "default") {
      const defaultValue = def.defaultValue;
      if (defaultValue !== undefined) {
        const defaultStr = formatDefaultValue(defaultValue, dialect);
        if (defaultStr) {
          constraints.push(`DEFAULT ${defaultStr}`);
        }
      }
    }
  }

  return [columnName, sqlType, ...constraints].join(" ").trimEnd();
}

/**
 * Formats a default value for SQL.
 *
 * @param value - Default value.
 * @param dialect - SQL dialect.
 * @returns SQL fragment for the default value.
 */
function formatDefaultValue(value: unknown, dialect: Dialect): string | null {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "string") {
    return `'${escapeSqlString(value)}'`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    if (dialect === "postgres" || dialect === "mysql") {
      return value ? "TRUE" : "FALSE";
    }
    return value ? "1" : "0";
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // JSON values
  try {
    const jsonValue = JSON.stringify(value);
    const escaped = escapeSqlString(jsonValue);
    if (dialect === "postgres") {
      return `'${escaped}'::jsonb`;
    }
    if (dialect === "mysql") {
      return `CAST('${escaped}' AS JSON)`;
    }
    return `'${escaped}'`;
  } catch {
    return null;
  }
}

/**
 * Escapes single quotes in SQL strings.
 *
 * @param value - String to escape.
 * @returns Escaped string.
 */
function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

/**
 * Generates a CREATE TABLE statement for the provided entity.
 * STRICTLY FILTERS: only generates fields where stored === true.
 *
 * @param entity - TSERA entity runtime.
 * @param dialect - SQL dialect (default: postgres).
 * @returns SQL CREATE TABLE statement.
 */
export function entityToDDL(entity: EntityRuntime, dialect: Dialect = "postgres"): string {
  if (!entity.table) {
    return `-- Entity ${entity.name} is not mapped to a table.`;
  }

  // STRICTLY FILTER: only keep fields where stored === true
  const storedFields = filterStoredFields(entity.fields);

  if (Object.keys(storedFields).length === 0) {
    return `-- Entity ${entity.name} has no stored fields.`;
  }

  const tableName = pascalToSnakeCase(entity.name);
  const columnDefinitions: string[] = [];

  // Extract the shape from the Zod schema
  const schemaDef = getZodInternal(entity.schema).def;
  if (schemaDef.type !== "object") {
    throw new Error(`Entity ${entity.name} schema is not a ZodObject`);
  }

  const shape = schemaDef.shape;
  if (!shape) {
    throw new Error(`Entity ${entity.name} schema has no shape`);
  }

  for (const [name, field] of Object.entries(storedFields)) {
    const zodSchema = shape[name] as ZodType;
    if (!zodSchema) {
      continue;
    }
    columnDefinitions.push(formatColumn(name, field, zodSchema, dialect));
  }

  if (columnDefinitions.length === 0) {
    return `-- Entity ${entity.name} has no valid stored fields.`;
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columnDefinitions.join(",\n")}\n);`;
}
