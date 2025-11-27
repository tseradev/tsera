import { join } from "../../../shared/path.ts";
import type { ArtifactBuilder } from "./types.ts";
import {
  addImportDeclaration,
  createInMemorySourceFile,
  createTSeraProject,
} from "../../utils/ts-morph.ts";
import { VariableDeclarationKind } from "../../utils/ts-morph.ts";
import type { ZodType } from "../../../core/utils/zod.ts";

/**
 * Internal Zod definition structure (for accessing _zod.def).
 * This is used to access Zod's internal API which is not part of the public types.
 */
interface ZodInternalDef {
  type: string;
  checks?: Array<{ def?: { format?: string; min?: number; max?: number } }>;
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
  description?: string;
} & ZodType;

/**
 * Converts a Zod schema to a TypeScript expression.
 * This function analyzes the Zod schema to generate the corresponding TypeScript code.
 *
 * @param zodSchema - Zod schema to convert.
 * @returns TypeScript expression representing the schema.
 */
function zodSchemaToTsExpression(zodSchema: ZodType): string {
  const zodWithInternal = zodSchema as unknown as ZodWithInternal;
  const def = zodWithInternal._zod.def;

  // Handle ZodString
  if (def.type === "string") {
    let expr = "z.string()";
    if (def.checks) {
      for (const check of def.checks) {
        const checkDef = check.def;
        if (checkDef?.format === "email") {
          expr += ".email()";
        } else if (checkDef?.format === "uuid") {
          expr += ".uuid()";
        } else if (checkDef?.min !== undefined) {
          expr += `.min(${checkDef.min})`;
        } else if (checkDef?.max !== undefined) {
          expr += `.max(${checkDef.max})`;
        }
      }
    }
    if (zodWithInternal.description) {
      expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
    }
    return expr;
  }

  // Handle ZodNumber
  if (def.type === "number") {
    let expr = "z.number()";
    if (def.checks) {
      for (const check of def.checks) {
        const checkDef = check.def;
        if (checkDef?.min !== undefined) {
          expr += `.min(${checkDef.min})`;
        } else if (checkDef?.max !== undefined) {
          expr += `.max(${checkDef.max})`;
        }
      }
    }
    if (zodWithInternal.description) {
      expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
    }
    return expr;
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    let expr = "z.boolean()";
    if (zodWithInternal.description) {
      expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
    }
    return expr;
  }

  // Handle ZodDate
  if (def.type === "date") {
    let expr = "z.date()";
    if (zodWithInternal.description) {
      expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
    }
    return expr;
  }

  // Handle ZodArray
  if (def.type === "array") {
    if (def.element) {
      let expr = `z.array(${zodSchemaToTsExpression(def.element)})`;
      if (zodWithInternal.description) {
        expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
      }
      return expr;
    }
    return "z.array(z.any())";
  }

  // Handle ZodObject
  if (def.type === "object") {
    if (!def.shape) {
      return "z.object({}).strict()";
    }
    const shape = def.shape;
    const properties: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties.push(`${key}: ${zodSchemaToTsExpression(value as ZodType)}`);
    }
    let expr = `z.object({\n    ${properties.join(",\n    ")}\n  }).strict()`;
    if (zodWithInternal.description) {
      expr += `.describe(${JSON.stringify(zodWithInternal.description)})`;
    }
    return expr;
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    if (def.innerType) {
      return `${zodSchemaToTsExpression(def.innerType)}.optional()`;
    }
    return "z.any().optional()";
  }

  // Handle ZodDefault
  if (def.type === "default") {
    if (def.innerType) {
      const defaultValue = def.defaultValue;
      const defaultValueStr = defaultValue !== undefined ? toTsLiteral(defaultValue) : "undefined";
      return `${zodSchemaToTsExpression(def.innerType)}.default(${defaultValueStr})`;
    }
    return "z.any()";
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    if (def.innerType) {
      return `${zodSchemaToTsExpression(def.innerType)}.nullable()`;
    }
    return "z.any().nullable()";
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    return "z.any()";
  }

  // Fallback
  return "z.any()";
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
 * Escapes TypeScript reserved words by appending an underscore.
 * Reserved words cannot be used as identifiers in strict mode.
 *
 * @param name - Identifier name to escape.
 * @returns Escaped identifier name.
 */
function escapeReservedWord(name: string): string {
  const reservedWords = new Set([
    "abstract", "any", "as", "asserts", "assert", "async", "await",
    "boolean", "break", "case", "catch", "class", "const", "constructor",
    "continue", "debugger", "declare", "default", "delete", "do", "else",
    "enum", "export", "extends", "false", "finally", "for", "from", "function",
    "if", "implements", "import", "in", "infer", "instanceof", "interface",
    "is", "keyof", "let", "module", "namespace", "never", "new", "null",
    "number", "object", "of", "package", "private", "protected", "public",
    "readonly", "return", "satisfies", "static", "string", "super", "switch",
    "symbol", "this", "throw", "true", "try", "type", "typeof", "undefined",
    "unique", "unknown", "using", "var", "void", "while", "with", "yield",
  ]);
  return reservedWords.has(name) ? `${name}_` : name;
}

/**
 * Generates Zod artifacts for an entity.
 * Generates the User super-object with schema, public, input, and the User namespace with types.
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

  const entityName = entity.name;

  // Generate expressions for schemas
  const schemaExpr = zodSchemaToTsExpression(entity.schema);
  const publicExpr = zodSchemaToTsExpression(entity.public);
  const inputCreateExpr = zodSchemaToTsExpression(entity.input.create);
  const inputUpdateExpr = zodSchemaToTsExpression(entity.input.update);

  // Export individual schemas
  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: `${entityName}Schema`,
      initializer: schemaExpr,
    }],
  });

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: `${entityName}PublicSchema`,
      initializer: publicExpr,
    }],
  });

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: `${entityName}InputCreateSchema`,
      initializer: inputCreateExpr,
    }],
  });

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: `${entityName}InputUpdateSchema`,
      initializer: inputUpdateExpr,
    }],
  });

  // Export the User super-object
  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{
      name: entityName,
      initializer: `{
  schema: ${entityName}Schema,
  public: ${entityName}PublicSchema,
  input: {
    create: ${entityName}InputCreateSchema,
    update: ${entityName}InputUpdateSchema,
  },
} as const`,
    }],
  });

  // Export the User namespace with types
  // Escape reserved words to avoid TypeScript errors
  const typeName = escapeReservedWord("type");
  const publicName = escapeReservedWord("public");
  const inputCreateName = escapeReservedWord("input_create");
  const inputUpdateName = escapeReservedWord("input_update");
  const idName = escapeReservedWord("id");

  sourceFile.addModule({
    isExported: true,
    name: entityName,
    statements: [
      `export type ${typeName} = z.infer<typeof ${entityName}Schema>;`,
      `export type ${publicName} = z.infer<typeof ${entityName}PublicSchema>;`,
      `export type ${inputCreateName} = z.input<typeof ${entityName}InputCreateSchema>;`,
      `export type ${inputUpdateName} = z.input<typeof ${entityName}InputUpdateSchema>;`,
      `export type ${idName} = ${typeName}["id"];`,
    ],
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
