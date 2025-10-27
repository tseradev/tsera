import type { EntityDef, TColumn, TPrimitive } from "./entity.ts";
import { isArrayColumnType } from "./entity.ts";
import { pascalToSnakeCase } from "./utils/strings.ts";

type Dialect = "postgres" | "sqlite";

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

function mapColumnType(column: TColumn, dialect: Dialect): string {
  if (isArrayColumnType(column.type)) {
    return dialect === "postgres" ? "JSONB" : "TEXT";
  }

  return mapPrimitiveType(column.type, dialect);
}

function mapPrimitiveType(type: TPrimitive, dialect: Dialect): string {
  switch (type) {
    case "string":
      return dialect === "postgres" ? "TEXT" : "TEXT";
    case "number":
      return "INTEGER";
    case "boolean":
      return dialect === "postgres" ? "BOOLEAN" : "INTEGER";
    case "date":
      return dialect === "postgres" ? "TIMESTAMP" : "TEXT";
    case "json":
      return dialect === "postgres" ? "JSONB" : "TEXT";
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported primitive type: ${exhaustiveCheck}`);
    }
  }
}

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
      return dialect === "postgres" ? (value ? "TRUE" : "FALSE") : value ? "1" : "0";
    case "date":
      if (value instanceof Date) {
        return `'${value.toISOString()}'`;
      }
      if (typeof value === "string") {
        return `'${escapeSqlString(value)}'`;
      }
      throw new TypeError("Default value for date column must be a Date or ISO string");
    default: {
      const exhaustiveCheck: never = column.type;
      throw new Error(`Unsupported column type for default: ${exhaustiveCheck}`);
    }
  }
}

function formatJsonDefault(value: unknown, dialect: Dialect): string {
  const jsonValue = JSON.stringify(value);
  if (jsonValue === undefined) {
    throw new TypeError("Default value for JSON column must be JSON-serialisable");
  }

  const escaped = escapeSqlString(jsonValue);
  return dialect === "postgres" ? `'${escaped}'::jsonb` : `'${escaped}'`;
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}
