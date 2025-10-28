import { join } from "../../../shared/path.ts";
import { entityToDDL } from "tsera/core/drizzle.ts";
import { pascalToSnakeCase } from "tsera/core/utils/strings.ts";
import type { ArtifactBuilder } from "./types.ts";

function formatTimestamp(date: Date, microseconds: number): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const micros = Math.floor(microseconds % 1_000_000).toString().padStart(6, "0");
  return `${year}${month}${day}${hours}${minutes}_${micros}`;
}

function nextMigrationFile(entityName: string): string {
  const slug = pascalToSnakeCase(entityName);
  const now = new Date();
  const micros = Math.floor((now.getTime() % 1000) * 1000 + Math.floor(performance.now() % 1000));
  return `${formatTimestamp(now, micros)}_${slug}.sql`;
}

export const buildDrizzleArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const fileName = nextMigrationFile(entity.name);
  const path = join("drizzle", fileName);
  const content = entityToDDL(entity, config.db.dialect);

  return [{
    kind: "migration",
    path,
    content: content.endsWith("\n") ? content : `${content}\n`,
    label: `${entity.name} migration`,
    data: { entity: entity.name },
  }];
};
