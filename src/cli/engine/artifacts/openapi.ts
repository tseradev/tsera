import { join } from "../../../shared/path.ts";
import { generateOpenAPIDocument } from "../../../core/openapi.ts";
import type { EntityRuntime } from "../../../core/entity.ts";
import { pascalToSnakeCase } from "../../../core/utils/strings.ts";
import type { ArtifactDescriptor } from "../dag.ts";
import type { TseraConfig } from "../../definitions.ts";

/**
 * Recursively sorts object keys for deterministic JSON output.
 *
 * This function ensures that JSON output is stable across different runs
 * by sorting object keys alphabetically. This is important for
 * reproducible builds and consistent artifact generation.
 *
 * @param value - Value to sort.
 * @returns Sorted value with deterministic key order.
 */
function sortObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = sortObject(val);
    }
    return result as unknown as T;
  }
  return value;
}

/**
 * Builds dependency identifiers for OpenAPI artifact based on schema artifacts.
 *
 * This function creates dependency node identifiers that link the OpenAPI
 * artifact to the schema artifacts it depends on. Each schema artifact
 * is identified by its kind, entity slug, and file path.
 *
 * @param entities - Array of entity runtimes.
 * @param outDir - Output directory for schema artifacts.
 * @returns Array of dependency node identifiers.
 */
function buildDependencies(
  entities: readonly EntityRuntime[],
  outDir: string,
): string[] {
  const dependencies: string[] = [];
  for (const entity of entities) {
    const slug = pascalToSnakeCase(entity.name);
    const schemaPath = join(outDir, "schemas", `${entity.name}.schema.ts`);
    dependencies.push(`schema:${slug}:${schemaPath}`);
  }
  return dependencies;
}

/**
 * Builds project-level OpenAPI artifact from all entities.
 *
 * This function generates a single OpenAPI specification document that
 * aggregates schemas from all entities with OpenAPI generation enabled.
 * The document is sorted deterministically and written to the docs directory.
 *
 * Only entities with `openapi.enabled !== false` are included in the
 * generated specification. The generated document uses only the `public`
 * schema for each entity to filter out internal and secret fields.
 *
 * @param entities - Array of entity runtimes.
 * @param config - TSera configuration.
 * @returns OpenAPI artifact descriptor, or {@code null} if OpenAPI is disabled.
 */
export function buildProjectOpenAPIArtifact(
  entities: readonly EntityRuntime[],
  config: TseraConfig,
): ArtifactDescriptor | null {
  if (!config.openapi) {
    return null;
  }

  // Filter entities with openapi.enabled !== false
  const enabledEntities = entities.filter(
    (entity) => entity.openapi?.enabled !== false,
  );

  const document = generateOpenAPIDocument(enabledEntities, {
    title: "TSera API",
    version: "1.0.0",
  });
  const sorted = sortObject(document);
  const content = JSON.stringify(sorted, null, 2) + "\n";
  const path = join("docs", "openapi", "OpenAPI.json");
  const dependsOn = buildDependencies(enabledEntities, config.outDir);

  return {
    kind: "openapi",
    path,
    content,
    label: "Project OpenAPI",
    data: { entities: enabledEntities.map((entity) => entity.name) },
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
  };
}
