import { join } from "../../../shared/path.ts";
import type { TColumn } from "tsera/core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";

export const buildDocsArtifacts: ArtifactBuilder = (context) => {
  const { entity } = context;
  const lines: string[] = [
    `# ${entity.name}`,
    "",
    "| Propriété | Type | Optionnel | Nullable | Défaut |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const [name, column] of Object.entries(entity.columns)) {
    const type = columnType(column);
    const optional = column.optional ? "oui" : "non";
    const nullable = column.nullable ? "oui" : "non";
    const defaultValue = column.default !== undefined ? formatDefault(column.default) : "—";
    lines.push(`| ${name} | ${type} | ${optional} | ${nullable} | ${defaultValue} |`);
  }

  if (entity.doc) {
    lines.push(
      "",
      entity.doc === true ? `Documentation automatique pour ${entity.name}.` : String(entity.doc),
    );
  }

  const path = join("docs", `${entity.name}.md`);

  return [{
    kind: "doc",
    path,
    content: lines.join("\n") + "\n",
    label: `${entity.name} documentation`,
    data: { entity: entity.name },
  }];
};

function columnType(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    return `Array<${column.type.arrayOf}>`;
  }
  return String(column.type);
}

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
