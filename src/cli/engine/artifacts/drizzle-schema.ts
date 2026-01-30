import { join } from "../../../shared/path.ts";
import { entityToDrizzleTable } from "../../../core/drizzle-schema.ts";
import type { ArtifactBuilder } from "./types.ts";

/**
 * Builds Drizzle TypeScript schema artifacts for an entity.
 *
 * This function generates a TypeScript file containing the Drizzle ORM
 * table definition for an entity. The generated file exports the table
 * definition and can be imported for use in database queries.
 *
 * Only entities with `table: true` generate schema artifacts. Entities
 * without a table configuration return an empty array.
 *
 * The generated schema file is placed in the `db/schema` directory
 * within the configured output directory.
 *
 * @param context - Artifact context containing entity and configuration.
 * @param context.entity - Entity runtime with field definitions.
 * @param context.config - TSera configuration with database dialect.
 * @returns Array of artifact descriptors containing the Drizzle schema file.
 */
export const buildDrizzleSchemaArtifact: ArtifactBuilder = (context) => {
  const { entity, config } = context;

  // Only generate schema for entities with table: true
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
