import { join } from "../../../shared/path.ts";
import { entityToOpenAPI } from "tsera/core/openapi.ts";
import type { ArtifactBuilder } from "./types.ts";

export const buildOpenAPIArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const document = entityToOpenAPI(entity, {
    title: `${config.projectName} API`,
    version: "1.0.0",
  });
  const json = JSON.stringify(sortObject(document), null, 2) + "\n";
  const path = join(config.artifactsDir, "openapi", `${entity.name}.json`);

  return [{
    kind: "openapi",
    path,
    content: json,
    label: `${entity.name} OpenAPI`,
    data: { entity: entity.name },
  }];
};

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
