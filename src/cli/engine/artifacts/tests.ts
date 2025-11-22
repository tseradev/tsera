import { join } from "../../../shared/path.ts";
import { posixPath } from "../../../shared/path.ts";
import type { EntityRuntime, FieldDef } from "../../../core/entity.ts";
import { filterPublicFields } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";
import {
  addImportDeclaration,
  createInMemorySourceFile,
  createTSeraProject,
} from "../../utils/ts-morph.ts";
import type { ZodType } from "../../../core/utils/zod.ts";

/**
 * Internal Zod definition structure (for accessing _zod.def).
 * This is used to access Zod's internal API which is not part of the public types.
 */
interface ZodInternalDef {
  type: string;
  element?: ZodType;
  innerType?: ZodType;
  defaultValue?: unknown;
  shape?: Record<string, ZodType>;
}

/**
 * Helper type for accessing Zod's internal _zod property.
 * Uses unknown instead of any for type safety.
 */
type ZodWithInternal = {
  _zod: {
    def: ZodInternalDef;
  };
} & ZodType;

const { dirname: posixDirname, join: posixJoin, relative: posixRelative } = posixPath;

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
 * Generates a sample value from a Zod schema and a FieldDef.
 *
 * @param zodSchema - Zod schema.
 * @param field - FieldDef with example if available.
 * @returns Sample value as TypeScript string.
 */
function generateSampleValue(zodSchema: ZodType, field: FieldDef): string {
  // Use field.example if available
  if (field.example !== undefined) {
    return toTsLiteral(field.example);
  }

  // Otherwise, generate from the Zod type
  const zodWithInternal = zodSchema as unknown as ZodWithInternal;
  const def = zodWithInternal._zod.def;

  // Handle ZodString
  if (def.type === "string") {
    return '"example"';
  }

  // Handle ZodNumber
  if (def.type === "number") {
    return "1";
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    return "true";
  }

  // Handle ZodDate
  if (def.type === "date") {
    return 'new Date("2020-01-01T00:00:00.000Z")';
  }

  // Handle ZodArray
  if (def.type === "array") {
    if (def.element) {
      const itemValue = generateSampleValue(def.element, field);
      return `[${itemValue}]`;
    }
    return "[]";
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    return "{}";
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    if (def.innerType) {
      return generateSampleValue(def.innerType, field);
    }
  }

  // Handle ZodDefault
  if (def.type === "default") {
    const defaultValue = def.defaultValue;
    if (defaultValue !== undefined) {
      return toTsLiteral(defaultValue);
    }
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    if (def.innerType) {
      return generateSampleValue(def.innerType, field);
    }
  }

  // Fallback
  return "null";
}

/**
 * Converts a value to a TypeScript literal.
 *
 * @param value - Value to convert.
 * @returns TypeScript literal.
 */
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

/**
 * Builds a TypeScript object literal from fields.
 * Masks values of fields with visibility === "secret".
 *
 * @param entity - Entity runtime.
 * @param usePublic - If true, uses only public fields.
 * @returns TypeScript object literal.
 */
function buildSampleObject(entity: EntityRuntime, usePublic: boolean): string {
  const fields = usePublic ? filterPublicFields(entity.fields) : entity.fields;
  const schema = usePublic ? entity.public : entity.schema;

  const schemaWithInternal = schema as unknown as ZodWithInternal;
  const schemaDef = schemaWithInternal._zod.def;
  if (schemaDef.type !== "object" || !schemaDef.shape) {
    return "{}";
  }

  const shape = schemaDef.shape;
  const lines: string[] = ["{"];
  const entries = Object.entries(fields);

  entries.forEach(([name, field], index) => {
    const zodSchema = shape[name] as ZodType;
    if (!zodSchema) {
      return;
    }

    // Mask values of fields with visibility === "secret"
    let value: string;
    if (field.visibility === "secret") {
      value = '"***"'; // Mask secrets
    } else {
      value = generateSampleValue(zodSchema, field);
    }

    const suffix = index === entries.length - 1 ? "" : ",";
    lines.push(`    ${name}: ${value}${suffix}`);
  });

  lines.push("  }");
  return lines.join("\n");
}

/**
 * Generates test artifacts for an entity.
 * Public tests: use entity.public (fields with visibility === "public").
 * Internal tests: use filtered entity.schema (fields with visibility === "public" or "internal").
 * visibility === "secret": values masked/replaced in tests.
 */
export const buildTestArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;

  if (entity.test === false) {
    return [];
  }

  // Generate tests next to entities
  const testPath = posixJoin("core", "entities", `${entity.name}.test.ts`);
  const schemaPath = posixJoin(
    normalise(config.outDir),
    "schemas",
    `${entity.name}.schema.ts`,
  );
  const importPath = normaliseImport(
    posixRelative(posixDirname(testPath), schemaPath),
  );

  // Create a TS-Morph project and source file
  const project = createTSeraProject();
  const sourceFile = createInMemorySourceFile(
    project,
    `${entity.name}.test.ts`,
  );

  // Add imports
  addImportDeclaration(sourceFile, "std/assert", {
    namedImports: ["assertEquals"],
  });
  addImportDeclaration(sourceFile, importPath, {
    namedImports: [`${entity.name}Schema`, entity.name],
  });

  const entityName = entity.name;

  // Test with main schema (all fields, except masked secrets)
  const fullSample = buildSampleObject(entity, false);
  const fullKeys = Object.keys(entity.fields).sort();

  sourceFile.addStatements(`
Deno.test("${entityName} schema valide un exemple minimal", () => {
  const sample = ${fullSample}; 
  const parsed = ${entityName}Schema.parse(sample);
  assertEquals(Object.keys(parsed).sort(), ${JSON.stringify(fullKeys)});
});
`);

  // Test with public schema (only fields with visibility === "public")
  const publicFields = filterPublicFields(entity.fields);
  if (Object.keys(publicFields).length > 0) {
    const publicSample = buildSampleObject(entity, true);
    const publicKeys = Object.keys(publicFields).sort();

    sourceFile.addStatements(`
Deno.test("${entityName} public schema valide un exemple minimal", () => {
  const sample = ${publicSample};
  const parsed = ${entityName}.public.parse(sample);
  assertEquals(Object.keys(parsed).sort(), ${JSON.stringify(publicKeys)});
});
`);
  }

  // Test input.create
  const inputCreateSample = buildSampleObject(entity, false);
  sourceFile.addStatements(`
Deno.test("${entityName} input.create valide un exemple minimal", () => {
  const sample = ${inputCreateSample};
  const parsed = ${entityName}.input.create.parse(sample);
  // Verify that excluded fields are not present
  assertEquals(typeof parsed, "object");
});
`);

  // Format and get the generated text
  sourceFile.formatText();
  let content = sourceFile.getFullText();

  // TS-Morph may format std/assert to @std/assert, fix it
  content = content.replace(/(from\s+["'])@std\/assert(["'])/g, "$1std/assert$2");

  const path = join("core", "entities", `${entity.name}.test.ts`);

  return [{
    kind: "test",
    path,
    content,
    label: `${entity.name} test`,
    data: { entity: entity.name },
  }];
};
