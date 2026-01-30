import { join } from "../../../shared/path.ts";
import { entityToDDL } from "../../../core/drizzle.ts";
import { pascalToSnakeCase } from "../../../core/utils/strings.ts";
import { hashValue } from "../hash.ts";
import type { ArtifactBuilder } from "./types.ts";

/**
 * Derives a deterministic timestamp from a hash for migration file naming.
 *
 * This function creates a timestamp that is deterministic based on the hash
 * value, ensuring that the same entity and DDL always produce the same
 * migration filename. This is important for reproducible builds and
 * consistent artifact generation across different environments.
 *
 * The timestamp format is: YYYYMMDDHHMM_microseconds
 *
 * @param hash - Hash value to derive timestamp from.
 * @returns Timestamp string in format YYYYMMDDHHMM_microseconds.
 */
function deriveDeterministicTimestamp(hash: string): string {
  const year = 2000 + (parseInt(hash.slice(0, 4), 16) % 1000);
  const month = (parseInt(hash.slice(4, 6), 16) % 12) + 1;
  const day = (parseInt(hash.slice(6, 8), 16) % 28) + 1;
  const hours = parseInt(hash.slice(8, 10), 16) % 24;
  const minutes = parseInt(hash.slice(10, 12), 16) % 60;
  const micros = parseInt(hash.slice(12, 18), 16) % 1_000_000;
  return `${year.toString().padStart(4, "0")}${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")
    }${hours
      .toString()
      .padStart(2, "0")
    }${minutes.toString().padStart(2, "0")}_${micros.toString().padStart(6, "0")}`;
}

/**
 * Generates a deterministic migration filename from entity name and DDL.
 *
 * This function creates a migration filename that is deterministic based on
 * the entity name and DDL content. The filename includes a timestamp
 * derived from a hash of the entity and DDL, ensuring reproducible
 * builds.
 *
 * The filename format is: {timestamp}_{entity_slug}.sql
 *
 * @param entityName - Name of the entity.
 * @param ddl - SQL DDL statement.
 * @returns Migration filename.
 */
async function nextMigrationFile(
  entityName: string,
  ddl: string,
): Promise<string> {
  const slug = pascalToSnakeCase(entityName);
  const hash = await hashValue({ entity: entityName, ddl }, {
    version: "drizzle:filename",
    salt: slug,
  });
  return `${deriveDeterministicTimestamp(hash)}_${slug}.sql`;
}

/**
 * Builds Drizzle migration artifacts for an entity.
 *
 * This function generates SQL migration files for entities that have
 * database tables. The migration files are placed in the migrations
 * directory and follow the naming convention: {timestamp}_{slug}.sql
 *
 * The function strictly filters fields to only include those where `stored === true`.
 * Fields with `stored: false` are not included in the generated DDL.
 *
 * If no stored fields exist (DDL starts with "--"), no migration is
 * generated and an empty array is returned.
 *
 * @param context - Artifact context containing entity and configuration.
 * @param context.entity - Entity runtime with field definitions.
 * @param context.config - TSera configuration with database dialect.
 * @returns Array of artifact descriptors containing migration files.
 */
export const buildDrizzleArtifacts: ArtifactBuilder = async (context) => {
  const { entity, config } = context;

  // entityToDDL already filters fields with stored: false
  const content = entityToDDL(entity, config.db.dialect);

  // If no content (no stored fields), don't generate migration
  if (content.startsWith("--")) {
    return [];
  }

  const fileName = await nextMigrationFile(entity.name, content);
  const path = join("app", "db", "migrations", fileName);

  return [{
    kind: "migration",
    path,
    content: content.endsWith("\n") ? content : `${content}\n`,
    label: `${entity.name} migration`,
    data: { entity: entity.name },
  }];
};
