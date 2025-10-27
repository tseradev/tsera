import { join } from "../../../shared/path.ts";
import { posixPath } from "../../../shared/path.ts";
import type { TColumn } from "tsera/core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";

const { dirname: posixDirname, join: posixJoin, relative: posixRelative } = posixPath;

export const buildTestArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const testPath = posixJoin("tests", `${entity.name}.test.ts`);
  const schemaPath = posixJoin(
    normalise(config.artifactsDir),
    "schemas",
    `${entity.name}.schema.ts`,
  );
  const importPath = normaliseImport(posixRelative(posixDirname(testPath), schemaPath));
  const objectLiteral = buildSampleObject(entity.columns);
  const keys = Object.keys(entity.columns).sort();

  const lines: string[] = [
    'import { assertEquals } from "tsera/testing/asserts.ts";',
    `import { ${entity.name}Schema } from "${importPath}";`,
    "",
    `Deno.test("${entity.name} schema valide un exemple minimal", () => {`,
    `  const sample = ${objectLiteral};`,
    `  const parsed = ${entity.name}Schema.parse(sample);`,
    `  assertEquals(Object.keys(parsed).sort(), ${JSON.stringify(keys)});`,
    "});",
    "",
  ];

  const path = join("tests", `${entity.name}.test.ts`);

  return [{
    kind: "test",
    path,
    content: lines.join("\n"),
    label: `${entity.name} test`,
    data: { entity: entity.name },
  }];
};

function normaliseImport(path: string): string {
  const normalised = path.replace(/\\/g, "/");
  if (normalised.startsWith(".")) {
    return normalised;
  }
  return `./${normalised}`;
}

function normalise(path: string): string {
  return path.replace(/\\/g, "/");
}

function buildSampleObject(columns: Record<string, TColumn>): string {
  const lines: string[] = ["{"];
  const entries = Object.entries(columns);
  entries.forEach(([name, column], index) => {
    const value = sampleValue(column);
    const suffix = index === entries.length - 1 ? "" : ",";
    lines.push(`    ${name}: ${value}${suffix}`);
  });
  lines.push("  }");
  return lines.join("\n");
}

function sampleValue(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    const sample = samplePrimitive(column.type.arrayOf);
    return `[${sample}]`;
  }
  return samplePrimitive(column.type);
}

function samplePrimitive(type: TColumn["type"] extends infer T ? T : never): string {
  if (typeof type === "object" && type !== null && "arrayOf" in type) {
    const value = samplePrimitive(type.arrayOf);
    return `[${value}]`;
  }
  switch (type) {
    case "string":
      return '"example"';
    case "number":
      return "1";
    case "boolean":
      return "true";
    case "date":
      return 'new Date("2020-01-01T00:00:00.000Z")';
    case "json":
      return "{}";
    default:
      throw new Error(`Type de colonne non supporté: ${String(type)}`);
  }
}
