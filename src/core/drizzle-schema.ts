import type { EntityDef, TColumn } from "./entity.ts";
import { isArrayColumnType } from "./entity.ts";
import { pascalToSnakeCase } from "./utils/strings.ts";

export type Dialect = "postgres" | "sqlite" | "mysql";

/**
 * Generates a Drizzle ORM table definition (TypeScript code) for the provided entity.
 *
 * @param entity - Validated entity definition.
 * @param dialect - SQL dialect (postgres, sqlite, mysql).
 * @returns TypeScript code string defining the table.
 */
export function entityToDrizzleTable(entity: EntityDef, dialect: Dialect = "postgres"): string {
  if (!entity.table) {
    return `// Entity ${entity.name} is not mapped to a table.`;
  }

  const tableName = pascalToSnakeCase(entity.name);
  const variableName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);

  const imports = getImports(dialect);
  const columns = Object.entries(entity.columns)
    .map(([name, column]) => formatColumn(name, column, dialect))
    .join(",\n  ");

  return `${imports}

export const ${variableName} = ${getTableFunction(dialect)}("${tableName}", {
  ${columns}
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
    case "postgres": return "pgTable";
    case "mysql": return "mysqlTable";
    case "sqlite": return "sqliteTable";
  }
}

function formatColumn(name: string, column: TColumn, dialect: Dialect): string {
  let def = mapColumnType(column.type, dialect);

  // Add column name if different from property name (optional, here we assume 1:1 mapping for simplicity)
  // But Drizzle allows specifying column name: text("column_name")
  // We use the property name as the column name for now.

  def = `${def}("${name}")`;

  if (!column.optional && !column.nullable) {
    def += ".notNull()";
  }

  if (column.default !== undefined) {
    def += `.default(${JSON.stringify(column.default)})`; // Simplified default handling
  }

  return `${name}: ${def}`;
}

function mapColumnType(type: TColumn["type"], dialect: Dialect): string {
  if (isArrayColumnType(type)) {
    if (dialect === "postgres") return "jsonb";
    if (dialect === "mysql") return "json";
    return "text"; // SQLite stores JSON as text
  }

  switch (type) {
    case "string": return "text";
    case "number": return dialect === "postgres" || dialect === "sqlite" ? "integer" : "int";
    case "boolean": return dialect === "sqlite" ? "integer({ mode: 'boolean' })" : "boolean"; // SQLite boolean
    case "date": return dialect === "postgres" ? "timestamp" : (dialect === "mysql" ? "datetime" : "text");
    case "json": return dialect === "postgres" ? "jsonb" : (dialect === "mysql" ? "json" : "text");
  }
  return "text";
}
