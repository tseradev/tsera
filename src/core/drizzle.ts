/**
 * Minimal Drizzle SQL generator placeholder. The current implementation focuses
 * on producing deterministic SQL snippets for the default PostgreSQL dialect so
 * higher-level orchestration can be wired without runtime errors.
 */

import type { EntityDef, TPrimitive } from "./entity.ts";

export type SqlDialect = "postgres";

const DIALECT_DEFAULT: SqlDialect = "postgres";

const TYPE_MAP: Record<TPrimitive, string> = {
  string: "TEXT",
  number: "INTEGER",
  boolean: "BOOLEAN",
  date: "TIMESTAMP",
  json: "JSONB",
};

function resolveColumnType(column: { type: TPrimitive | { arrayOf: TPrimitive } }): string {
  if (typeof column.type === "string") {
    return TYPE_MAP[column.type];
  }
  return `${TYPE_MAP[column.type.arrayOf]}[]`;
}

export function entityToDDL(entity: EntityDef, dialect: SqlDialect = DIALECT_DEFAULT): string {
  if (dialect !== "postgres") {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  const columns = Object.entries(entity.columns).map(([name, column]) => {
    const parts = [name, resolveColumnType(column)];
    if (!column.optional) {
      parts.push("NOT NULL");
    }
    if (column.default !== undefined) {
      parts.push(`DEFAULT ${JSON.stringify(column.default)}`);
    }
    return parts.join(" ");
  });

  return [
    `CREATE TABLE IF NOT EXISTS ${entity.name} (`,
    `  ${columns.join(",\n  ")}`,
    ");",
  ].join("\n");
}
