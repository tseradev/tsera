import { join } from "../../../shared/path.ts";
import { generateOpenAPIDocument } from "tsera/core/openapi.ts";
import type { EntityDef } from "tsera/core/entity.ts";
import { pascalToSnakeCase } from "tsera/core/utils/strings.ts";
import type { ArtifactDescriptor } from "../dag.ts";
import type { TseraConfig } from "../../contracts/types.ts";

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

function buildDependencies(entities: readonly EntityDef[], outDir: string): string[] {
  const dependencies: string[] = [];
  for (const entity of entities) {
    const slug = pascalToSnakeCase(entity.name);
    const schemaPath = join(outDir, "schemas", `${entity.name}.schema.ts`);
    dependencies.push(`schema:${slug}:${schemaPath}`);
  }
  return dependencies;
}

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
  const path = join(config.outDir, "openapi.json");
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
