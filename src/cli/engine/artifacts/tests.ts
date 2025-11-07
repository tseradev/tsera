import { join } from "../../../shared/path.ts";
import { posixPath } from "../../../shared/path.ts";
import type { TColumn } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";
import {
  addImportDeclaration,
  createInMemorySourceFile,
  createTSeraProject,
} from "../../utils/ts-morph.ts";

const { dirname: posixDirname, join: posixJoin, relative: posixRelative } = posixPath;

/**
 * Builds smoke test artifacts for an entity using TS-Morph for AST-based generation.
 */
export const buildTestArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const testPath = posixJoin("tests", `${entity.name}.test.ts`);
  const schemaPath = posixJoin(
    normalise(config.outDir),
    "schemas",
    `${entity.name}.schema.ts`,
  );
  const importPath = normaliseImport(
    posixRelative(posixDirname(testPath), schemaPath),
  );
  const objectLiteral = buildSampleObject(entity.columns);
  const keys = Object.keys(entity.columns).sort();

  const assertsImport = normaliseImport(
    posixRelative(posixDirname(testPath), posixJoin("testing", "asserts.ts")),
  );

  // Create a TS-Morph project and source file
  const project = createTSeraProject();
  const sourceFile = createInMemorySourceFile(
    project,
    `${entity.name}.test.ts`,
  );

  // Add imports
  addImportDeclaration(sourceFile, assertsImport, {
    namedImports: ["assertEquals"],
  });
  addImportDeclaration(sourceFile, importPath, {
    namedImports: [`${entity.name}Schema`],
  });

  // Add the test using expression statement
  sourceFile.addStatements(`
Deno.test("${entity.name} schema valide un exemple minimal", () => {
  const sample = ${objectLiteral};
  const parsed = ${entity.name}Schema.parse(sample);
  assertEquals(Object.keys(parsed).sort(), ${JSON.stringify(keys)});
});
`);

  // Format and get the generated text
  sourceFile.formatText();
  const content = sourceFile.getFullText();

  const path = join("tests", `${entity.name}.test.ts`);

  return [{
    kind: "test",
    path,
    content,
    label: `${entity.name} test`,
    data: { entity: entity.name },
  }];
};

/**
 * Normalises an import path for use in generated test files.
 *
 * @param path - Import path to normalise.
 * @returns Normalised import path.
 */
function normaliseImport(path: string): string {
  const normalised = path.replace(/\\/g, "/");
  if (normalised.startsWith(".")) {
    return normalised;
  }
  return `./${normalised}`;
}

/**
 * Normalises a path by converting backslashes to forward slashes.
 *
 * @param path - Path to normalise.
 * @returns Normalised path.
 */
function normalise(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Builds a TypeScript object literal string from column definitions.
 *
 * @param columns - Map of column definitions.
 * @returns Object literal string.
 */
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

/**
 * Generates a sample value string for a column.
 *
 * @param column - Column definition.
 * @returns Sample value string.
 */
function sampleValue(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    const sample = samplePrimitive(column.type.arrayOf);
    return `[${sample}]`;
  }
  return samplePrimitive(column.type);
}

/**
 * Generates a sample value string for a primitive type.
 *
 * @param type - Primitive or array column type.
 * @returns Sample value string.
 * @throws {Error} If the type is not supported.
 */
function samplePrimitive(
  type: TColumn["type"] extends infer T ? T : never,
): string {
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
      throw new Error(`Unsupported column type: ${String(type)}`);
  }
}
