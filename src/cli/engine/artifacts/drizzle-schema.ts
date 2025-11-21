import { join } from "../../../shared/path.ts";
import { entityToDrizzleTable } from "../../../core/drizzle-schema.ts";
import type { ArtifactBuilder } from "./types.ts";

/**
 * Builds Drizzle TS schema artifacts for an entity.
 */
export const buildDrizzleSchemaArtifact: ArtifactBuilder = (context) => {
  const { entity, config } = context;

  if (!entity.table) {
    return [];
  }

  const content = entityToDrizzleTable(entity, config.db.dialect);
  const path = join(config.outDir, "db", "schema", `${entity.name}.ts`);

  return [{
    kind: "drizzle-schema",
    path,
    content,
    label: `${entity.name} Drizzle Table`,
    data: { entity: entity.name },
  }];
};
