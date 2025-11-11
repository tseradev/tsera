import { join } from "../../../shared/path.ts";
import { generateOpenAPIDocument } from "../../../core/openapi.ts";
import type { EntityDef } from "../../../core/entity.ts";
import { pascalToSnakeCase } from "../../../core/utils/strings.ts";
import type { ArtifactDescriptor } from "../dag.ts";
import type { TseraConfig } from "../../definitions.ts";

/**
 * Recursively sorts object keys for deterministic JSON output.
 *
 * @param value - Value to sort.
 * @returns Sorted value.
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
 * @param entities - Array of entity definitions.
 * @param outDir - Output directory.
 * @returns Array of dependency node identifiers.
 */
function buildDependencies(entities: readonly EntityDef[], outDir: string): string[] {
  const dependencies: string[] = [];
  for (const entity of entities) {
    const slug = pascalToSnakeCase(entity.name);
    const schemaPath = join(outDir, "schemas", `${entity.name}.schema.ts`);
    dependencies.push(`schema:${slug}:${schemaPath}`);
  }
  return dependencies;
}

/**
 * Builds the project-level OpenAPI artifact from all entities.
 *
 * @param entities - Array of entity definitions.
 * @param config - TSera configuration.
 * @returns OpenAPI artifact descriptor, or {@code null} if OpenAPI is disabled.
 */
export function buildProjectOpenAPIArtifact(
  entities: readonly EntityDef[],
  config: TseraConfig,
): ArtifactDescriptor | null {
  if (!config.openapi) {
    return null;
  }

  const document = generateOpenAPIDocument(entities, {
    title: "TSera API",
    version: "1.0.0",
  });
  const sorted = sortObject(document);
  const content = JSON.stringify(sorted, null, 2) + "\n";
  const path = join("docs", "openapi", "OpenAPI.json");
  const dependsOn = buildDependencies(entities, config.outDir);

  return {
    kind: "openapi",
    path,
    content,
    label: "Project OpenAPI",
    data: { entities: entities.map((entity) => entity.name) },
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
  };
}
