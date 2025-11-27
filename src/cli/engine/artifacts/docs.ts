import { join } from "../../../shared/path.ts";
import { filterPublicFields } from "../../../core/entity.ts";
import type { ArtifactBuilder } from "./types.ts";
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

/**
 * Extracts the type from a Zod schema for documentation.
 *
 * @param zodSchema - Zod schema to analyze.
 * @returns Type string for documentation.
 */
function extractTypeFromZod(zodSchema: ZodType): string {
  const zodWithInternal = zodSchema as unknown as ZodWithInternal;
  const def = zodWithInternal._zod.def;

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

/**
 * Generates Markdown documentation artifacts for an entity.
 * Public docs: only fields with visibility === "public".
 * Internal docs: fields with visibility === "public" or "internal".
 * visibility === "secret": field NEVER in docs.
 */
export const buildDocsArtifacts: ArtifactBuilder = (context) => {
  const { entity } = context;

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

    // Extract the shape from the public schema
    const publicWithInternal = entity.public as unknown as ZodWithInternal;
    const schemaDef = publicWithInternal._zod.def;
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
        const zodWithInternal = zodSchema as unknown as ZodWithInternal;
        const zodDef = zodWithInternal._zod.def;
        const isOptional = zodDef.type === "optional";
        const innerDef = zodDef.innerType
          ? (zodDef.innerType as unknown as ZodWithInternal)._zod.def
          : null;
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

    const schemaWithInternal = entity.schema as unknown as ZodWithInternal;
    const schemaDef = schemaWithInternal._zod.def;
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

  return [{
    kind: "doc",
    path,
    content: lines.join("\n") + "\n",
    label: `${entity.name} documentation`,
    data: { entity: entity.name },
  }];
};
