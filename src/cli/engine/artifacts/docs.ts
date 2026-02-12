import { join } from "../../../shared/path.ts";
import { filterPublicFields } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";
import { applyGeneratedTextHeader } from "./generated-header.ts";
import { getZodInternal, type ZodType } from "../../../core/utils/zod.ts";

/**
 * Extracts type from a Zod schema for documentation.
 *
 * This function analyzes Zod schema structure to determine the
 * TypeScript type representation for documentation purposes. It handles
 * primitive types, arrays, and optional/nullable wrappers.
 *
 * @param zodSchema - Zod schema to analyze.
 * @returns Type string for documentation (e.g., "string", "number", "Array<string>").
 */
function extractTypeFromZod(zodSchema: ZodType): string {
  const { def } = getZodInternal(zodSchema);

  // Handle ZodString
  if (def.type === "string") {
    return "string";
  }

  // Handle ZodNumber
  if (def.type === "number") {
    return "number";
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    return "boolean";
  }

  // Handle ZodDate
  if (def.type === "date") {
    return "Date";
  }

  // Handle ZodArray
  if (def.type === "array") {
    if (def.element) {
      const itemType = extractTypeFromZod(def.element);
      return `Array<${itemType}>`;
    }
    return "Array<unknown>";
  }

  // Handle ZodAny (for JSON fields)
  if (def.type === "any") {
    return "any";
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    if (def.innerType) {
      return extractTypeFromZod(def.innerType);
    }
  }

  // Handle ZodDefault
  if (def.type === "default") {
    if (def.innerType) {
      return extractTypeFromZod(def.innerType);
    }
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    if (def.innerType) {
      return `${extractTypeFromZod(def.innerType)} | null`;
    }
  }

  // Fallback
  return "unknown";
}

/**
 * Formats a default value for documentation.
 *
 * This function converts various value types to their string
 * representation for use in Markdown documentation tables.
 *
 * @param value - Default value to format.
 * @returns Formatted string representation (e.g., `"example"`, `"null"`, `"CURRENT_TIMESTAMP"`).
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

/**
 * Builds Markdown documentation artifacts for an entity.
 *
 * This function generates Markdown documentation files that describe
 * entity structure, fields, and their properties. The documentation
 * is organized into sections:
 *
 * - **Public Fields**: Fields with `visibility === "public"` that are
 *   exposed in APIs and external interfaces.
 * - **Internal Fields**: Fields with `visibility === "internal"` that are
 *   used internally but not exposed publicly.
 * - **Secret Fields**: Fields with `visibility === "secret"` are NEVER
 *   included in documentation for security reasons.
 *
 * The documentation includes:
 * - Entity description (from `docs.description` or `openapi.description`)
 * - Field properties table (Property, Type, Optional, Nullable, Default, Description)
 * - Warning for internal fields that they are not exposed in public API
 *
 * @param context - Artifact context containing entity and configuration.
 * @param context.entity - Entity runtime with field definitions.
 * @returns Array of artifact descriptors containing Markdown documentation file.
 */
export const buildDocsArtifacts: ArtifactBuilder = async (context) => {
  const { entity, projectDir } = context;

  // Public docs: only fields with visibility === "public"
  const publicFields = filterPublicFields(entity.fields);

  const lines: string[] = [
    `# ${entity.name}`,
    "",
  ];

  // Description from entity.docs.description or entity.openapi.description
  if (entity.docs?.description) {
    lines.push(entity.docs.description, "");
  } else if (entity.openapi?.description) {
    lines.push(entity.openapi.description, "");
  }

  // Public fields table
  if (Object.keys(publicFields).length > 0) {
    lines.push(
      "## Public Fields",
      "",
      "| Property | Type | Optional | Nullable | Default | Description |",
      "| --- | --- | --- | --- | --- | --- |",
    );

    // Extract shape from public schema
    const schemaDef = getZodInternal(entity.public).def;
    if (schemaDef.type === "object" && schemaDef.shape) {
      const shape = schemaDef.shape;

      // Only iterate over fields that are actually in publicFields (visibility === "public")
      for (const [name, field] of Object.entries(publicFields)) {
        // Double-check that this field is actually public
        if (field.visibility !== undefined && field.visibility !== "public") {
          continue;
        }
        const zodSchema = shape[name] as ZodType;
        if (!zodSchema) {
          continue;
        }

        const type = extractTypeFromZod(zodSchema);
        const { def: zodDef } = getZodInternal(zodSchema);
        const isOptional = zodDef.type === "optional";
        const innerDef = zodDef.innerType ? getZodInternal(zodDef.innerType).def : null;
        const isNullable = zodDef.type === "nullable" ||
          (isOptional && innerDef?.type === "nullable");
        const optional = isOptional ? "yes" : "no";
        const nullable = isNullable ? "yes" : "no";

        // Default value
        let defaultValue = "—";
        if (zodDef.type === "default") {
          const defaultVal = zodDef.defaultValue;
          if (defaultVal !== undefined) {
            defaultValue = formatDefault(defaultVal);
          }
        } else if (field.db?.defaultNow) {
          defaultValue = "CURRENT_TIMESTAMP";
        }

        const description = field.description || "—";
        lines.push(
          `| ${name} | ${type} | ${optional} | ${nullable} | ${defaultValue} | ${description} |`,
        );
      }
    }
  }

  // Internal fields (visibility === "internal") - only if configured
  const internalFields = Object.entries(entity.fields).filter(
    ([, field]) => field.visibility === "internal",
  );

  if (internalFields.length > 0) {
    lines.push(
      "",
      "## Internal Fields",
      "",
      "> These fields are not exposed in the public API.",
      "",
    );
    lines.push(
      "| Property | Type | Description |",
      "| --- | --- | --- |",
    );

    const schemaDef = getZodInternal(entity.schema).def;
    if (schemaDef.type === "object" && schemaDef.shape) {
      const shape = schemaDef.shape;

      for (const [name, field] of internalFields) {
        const zodSchema = shape[name] as ZodType;
        if (!zodSchema) {
          continue;
        }

        const type = extractTypeFromZod(zodSchema);
        const description = field.description || "—";
        lines.push(`| ${name} | ${type} | ${description} |`);
      }
    }
  }

  // Note: visibility === "secret" NEVER appears in documentation

  const path = join("docs", "markdown", `${entity.name}.md`);
  const body = lines.join("\n") + "\n";
  const content = await applyGeneratedTextHeader({
    projectDir,
    targetPath: path,
    format: "md",
    source: `Entity ${entity.name}`,
    body,
  });

  return [{
    kind: "doc",
    path,
    content,
    label: `${entity.name} documentation`,
    data: { entity: entity.name },
  }];
};
