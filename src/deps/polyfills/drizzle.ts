import type { EntityDef, TColumn, TPrimitive } from "../../core/entity.ts";
import { isArrayColumnType } from "../../core/entity.ts";
import { pascalToSnakeCase } from "../../core/utils/strings.ts";

/** Supported SQL dialect identifiers for DDL generation. */
export type Dialect = "postgres" | "sqlite" | "mysql";

/**
 * Generates a CREATE TABLE statement for the provided entity when {@link EntitySpec.table}
 * is enabled. When the entity does not target a table, a comment describing the omission
 * is returned instead.
 *
 * @param entity - Validated entity definition to transform into SQL.
 * @param dialect - SQL dialect influencing type and default mapping (defaults to Postgres).
 * @returns SQL string representing the entity.
 */
export function entityToDDL(entity: EntityDef, dialect: Dialect = "postgres"): string {
  if (!entity.table) {
    return `-- Entity ${entity.name} is not mapped to a table.`;
  }

  const tableName = pascalToSnakeCase(entity.name);
  const columnDefinitions = Object.entries(entity.columns)
    .map(([name, column]) => formatColumn(name, column, dialect))
    .join(",\n");

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columnDefinitions}\n);`;
}

/**
 * Formats an individual column definition for inclusion in the CREATE TABLE statement.
 *
 * @param name - Column name as declared on the entity.
 * @param column - Column configuration describing type and constraints.
 * @param dialect - SQL dialect controlling generated syntax.
 * @returns A single column definition string.
 */
function formatColumn(name: string, column: TColumn, dialect: Dialect): string {
  const columnName = `  "${name}"`;
  const sqlType = mapColumnType(column, dialect);
  const constraints: string[] = [];

  if (!column.optional && !column.nullable) {
    constraints.push("NOT NULL");
  }

  if (column.default !== undefined) {
    constraints.push(`DEFAULT ${formatDefault(column, column.default, dialect)}`);
  }

  return [columnName, sqlType, ...constraints].join(" ").trimEnd();
}

/**
 * Resolves the SQL type for a column, delegating to array or primitive mappings.
 *
 * @param column - Column definition to translate.
 * @param dialect - SQL dialect controlling the mapping.
 * @returns Dialect-specific SQL type.
 */
function mapColumnType(column: TColumn, dialect: Dialect): string {
  if (isArrayColumnType(column.type)) {
    if (dialect === "postgres") {
      return "JSONB";
    }
    if (dialect === "mysql") {
      return "JSON";
    }
    return "TEXT";
  }

  return mapPrimitiveType(column.type, dialect);
}

/**
 * Maps a primitive column type to its SQL representation for the requested dialect.
 *
 * @param type - Primitive column type to convert.
 * @param dialect - SQL dialect controlling the conversion.
 * @returns SQL type string suitable for the dialect.
 */
function mapPrimitiveType(type: TPrimitive, dialect: Dialect): string {
  switch (type) {
    case "string":
      if (dialect === "mysql") {
        return "TEXT";
      }
      return "TEXT";
    case "number":
      if (dialect === "mysql") {
        return "INT";
      }
      return "INTEGER";
    case "boolean":
      if (dialect === "postgres") {
        return "BOOLEAN";
      }
      if (dialect === "mysql") {
        return "TINYINT(1)";
      }
      return "INTEGER";
    case "date":
      if (dialect === "postgres") {
        return "TIMESTAMP";
      }
      if (dialect === "mysql") {
        return "DATETIME";
      }
      return "TEXT";
    case "json":
      if (dialect === "postgres") {
        return "JSONB";
      }
      if (dialect === "mysql") {
        return "JSON";
      }
      return "TEXT";
  }
}

/**
 * Produces a SQL fragment describing the default value for a column.
 *
 * @param column - Column definition containing the type metadata.
 * @param value - Default value assigned to the column.
 * @param dialect - SQL dialect controlling formatting decisions.
 * @returns SQL literal representing the default value.
 */
function formatDefault(column: TColumn, value: unknown, dialect: Dialect): string {
  if (value === null) {
    return "NULL";
  }

  if (isArrayColumnType(column.type) || column.type === "json") {
    return formatJsonDefault(value, dialect);
  }

  switch (column.type) {
    case "string":
      if (typeof value !== "string") {
        throw new TypeError("Default value for string column must be a string");
      }
      return `'${escapeSqlString(value)}'`;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new TypeError("Default value for number column must be a valid number");
      }
      return String(value);
    case "boolean":
      if (typeof value !== "boolean") {
        throw new TypeError("Default value for boolean column must be a boolean");
      }
      if (dialect === "postgres") {
        return value ? "TRUE" : "FALSE";
      }
      if (dialect === "mysql") {
        return value ? "TRUE" : "FALSE";
      }
      return value ? "1" : "0";
    case "date":
      if (value instanceof Date) {
        return `'${value.toISOString()}'`;
      }
      if (typeof value === "string") {
        return `'${escapeSqlString(value)}'`;
      }
      throw new TypeError("Default value for date column must be a Date or ISO string");
  }

  throw new TypeError("Unsupported column type for default value");
}

/**
 * Serialises JSON values for use as SQL defaults, optionally applying dialect casting.
 *
 * @param value - Value to serialise as JSON.
 * @param dialect - SQL dialect controlling casting behaviour.
 * @returns SQL literal representing the JSON default value.
 */
function formatJsonDefault(value: unknown, dialect: Dialect): string {
  const jsonValue = JSON.stringify(value);
  if (jsonValue === undefined) {
    throw new TypeError("Default value for JSON column must be JSON-serialisable");
  }

  const escaped = escapeSqlString(jsonValue);
  if (dialect === "postgres") {
    return `'${escaped}'::jsonb`;
  }
  if (dialect === "mysql") {
    return `CAST('${escaped}' AS JSON)`;
  }
  return `'${escaped}'`;
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}
