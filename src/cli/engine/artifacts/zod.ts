import { join } from "../../../shared/path.ts";
import type { TColumn } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";
import {
  addImportDeclaration,
  createInMemorySourceFile,
  createTSeraProject,
} from "../../utils/ts-morph.ts";
import { VariableDeclarationKind } from "../../../deps/polyfills/ts-morph.ts";

/**
 * Builds Zod schema artifacts for an entity using TS-Morph for AST-based generation.
 */
export const buildZodArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const path = join(config.outDir, "schemas", `${entity.name}.schema.ts`);

  // Create a TS-Morph project and source file
  const project = createTSeraProject();
  const sourceFile = createInMemorySourceFile(
    project,
    `${entity.name}.schema.ts`,
  );

  // Add import for Zod
  addImportDeclaration(sourceFile, "zod", { namedImports: ["z"] });

  // Build the schema object properties
  const columnEntries = Object.entries(entity.columns);
  const properties = columnEntries.map(([name, column]) => {
    const expression = columnToZodExpression(column);
    return `${name}: ${expression}`;
  });

  // Add the schema constant declaration
  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: `${entity.name}Schema`,
      initializer: `z.object({\n  ${properties.join(",\n  ")}\n}).strict()`,
    }],
  });

  // Add the inferred type export
  sourceFile.addTypeAlias({
    isExported: true,
    name: `${entity.name}Input`,
    type: `z.infer<typeof ${entity.name}Schema>`,
  });

  // Format and get the generated text
  sourceFile.formatText();
  const content = sourceFile.getFullText();

  return [{
    kind: "schema",
    path,
    content,
    label: `${entity.name} schema`,
    data: { entity: entity.name },
  }];
};

/**
 * Converts a column definition to a Zod expression string.
 *
 * @param column - Column definition.
 * @returns Zod expression string.
 */
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
    expression += `.default(${toTsLiteral(column.default, column.type)})`;
  }

  return expression;
}

/**
 * Generates the base Zod expression for a column type.
 *
 * @param column - Column definition.
 * @returns Base Zod expression string.
 */
function baseZodExpression(column: TColumn): string {
  if (typeof column.type === "object" && "arrayOf" in column.type) {
    return `z.array(${primitiveToZod(column.type.arrayOf)})`;
  }
  return primitiveToZod(column.type);
}

/**
 * Converts a primitive type to a Zod expression string.
 *
 * @param type - Primitive or array column type.
 * @returns Zod expression string.
 * @throws {Error} If the type is not supported.
 */
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

/**
 * Converts a default value to a TypeScript literal string.
 *
 * @param value - Default value.
 * @param columnType - Column type for context.
 * @returns TypeScript literal string representation.
 */
function toTsLiteral(value: unknown, columnType: TColumn["type"]): string {
  if (value instanceof Date) {
    return `new Date(${JSON.stringify(value.toISOString())})`;
  }
  if (typeof value === "string") {
    // If column type is "date" and value looks like an ISO date string, convert it
    if (columnType === "date" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
      return `new Date(${JSON.stringify(value)})`;
    }
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
