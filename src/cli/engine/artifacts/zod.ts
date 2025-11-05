import { join } from "../../../shared/path.ts";
import type { TColumn } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";

const IMPORT_LINE = 'import { z } from "zod";';

export const buildZodArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const path = join(config.outDir, "schemas", `${entity.name}.schema.ts`);
  const lines: string[] = [IMPORT_LINE, "", `export const ${entity.name}Schema = z.object({`];

  const columnEntries = Object.entries(entity.columns);
  columnEntries.forEach(([name, column], index) => {
    const expression = columnToZodExpression(column);
    const suffix = index === columnEntries.length - 1 ? "" : ",";
    lines.push(`  ${name}: ${expression}${suffix}`);
  });

  lines.push(`}).strict();`);
  lines.push("", `export type ${entity.name}Input = z.infer<typeof ${entity.name}Schema>;`, "");

  return [{
    kind: "schema",
    path,
    content: lines.join("\n"),
    label: `${entity.name} schema`,
    data: { entity: entity.name },
  }];
};

function columnToZodExpression(column: TColumn): string {
  let expression = baseZodExpression(column);

  if (column.description) {
    expression += `.describe(${JSON.stringify(column.description)})`;
  }
  if (column.nullable) {
    expression += ".nullable()";
  }
  if (column.optional) {
    expression += ".optional()";
  }
  if (column.default !== undefined) {
    expression += `.default(${toTsLiteral(column.default)})`;
  }

  return expression;
}

function baseZodExpression(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    return `z.array(${primitiveToZod(column.type.arrayOf)})`;
  }
  return primitiveToZod(column.type);
}

function primitiveToZod(type: TColumn["type"] extends infer T ? T : never): string {
  if (typeof type === "object" && type !== null && "arrayOf" in type) {
    return `z.array(${primitiveToZod(type.arrayOf)})`;
  }
  switch (type) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "date":
      return "z.date()";
    case "json":
      return "z.any()";
    default:
      throw new Error(`Unsupported column type: ${String(type)}`);
  }
}

function toTsLiteral(value: unknown): string {
  if (value instanceof Date) {
    return `new Date(${JSON.stringify(value.toISOString())})`;
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value);
}
