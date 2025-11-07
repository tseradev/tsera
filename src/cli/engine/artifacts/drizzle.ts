import { join } from "../../../shared/path.ts";
import { entityToDDL } from "../../../core/drizzle.ts";
import { pascalToSnakeCase } from "../../../core/utils/strings.ts";
import { hashValue } from "../hash.ts";
import type { ArtifactBuilder } from "./types.ts";

/**
 * Derives a deterministic timestamp from a hash for migration file naming.
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
  return `${year.toString().padStart(4, "0")}${month.toString().padStart(2, "0")}${
    day.toString().padStart(2, "0")
  }${
    hours
      .toString().padStart(2, "0")
  }${minutes.toString().padStart(2, "0")}_${micros.toString().padStart(6, "0")}`;
}

/**
 * Generates a deterministic migration filename from entity name and DDL.
 *
 * @param entityName - Name of the entity.
 * @param ddl - SQL DDL statement.
 * @returns Migration filename.
 */
async function nextMigrationFile(entityName: string, ddl: string): Promise<string> {
  const slug = pascalToSnakeCase(entityName);
  const hash = await hashValue({ entity: entityName, ddl }, {
    version: "drizzle:filename",
    salt: slug,
  });
  return `${deriveDeterministicTimestamp(hash)}_${slug}.sql`;
}

/**
 * Builds Drizzle migration artifacts for an entity.
 */
export const buildDrizzleArtifacts: ArtifactBuilder = async (context) => {
  const { entity, config } = context;
  const content = entityToDDL(entity, config.db.dialect);
  const fileName = await nextMigrationFile(entity.name, content);
  const path = join("drizzle", fileName);

  return [{
    kind: "migration",
    path,
    content: content.endsWith("\n") ? content : `${content}\n`,
    label: `${entity.name} migration`,
    data: { entity: entity.name },
  }];
};
