import { join } from "../../../shared/path.ts";
import type { TColumn } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";

/**
 * Builds Markdown documentation artifacts for an entity.
 */
export const buildDocsArtifacts: ArtifactBuilder = (context) => {
  const { entity } = context;
  const lines: string[] = [
    `# ${entity.name}`,
    "",
    "| Property | Type | Optional | Nullable | Default |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const [name, column] of Object.entries(entity.columns)) {
    const type = columnType(column);
    const optional = column.optional ? "yes" : "no";
    const nullable = column.nullable ? "yes" : "no";
    const defaultValue = column.default !== undefined ? formatDefault(column.default) : "—";
    lines.push(`| ${name} | ${type} | ${optional} | ${nullable} | ${defaultValue} |`);
  }

  if (entity.doc) {
    lines.push(
      "",
      entity.doc === true ? `Automatic documentation for ${entity.name}.` : String(entity.doc),
    );
  }

  const path = join("docs", "markdown", `${entity.name}.md`);

  return [{
    kind: "doc",
    path,
    content: lines.join("\n") + "\n",
    label: `${entity.name} documentation`,
    data: { entity: entity.name },
  }];
};

/**
 * Formats a column type as a string for documentation.
 *
 * @param column - Column definition.
 * @returns Type string representation.
 */
function columnType(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    return `Array<${column.type.arrayOf}>`;
  }
  return String(column.type);
}

/**
 * Formats a default value as a string for documentation.
 *
 * @param value - Default value.
 * @returns Formatted string representation.
 */
function formatDefault(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return `\`${value}\``;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "`" + JSON.stringify(value) + "`";
}
