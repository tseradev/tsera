import { join } from "../../../shared/path.ts";
import { entityToDDL } from "tsera/core/drizzle.ts";
import { pascalToSnakeCase } from "tsera/core/utils/strings.ts";
import type { ArtifactBuilder } from "./types.ts";

export const buildDrizzleArtifacts: ArtifactBuilder = (context) => {
  const { entity, config } = context;
  const slug = pascalToSnakeCase(entity.name);
  const fileName = `197001010000_${slug}.sql`;
  const path = join(config.db.migrationsDir, fileName);
  const content = entityToDDL(entity, config.db.dialect);

  return [{
    kind: "migration",
    path,
    content: content.endsWith("\n") ? content : `${content}\n`,
    label: `${entity.name} migration`,
    data: { entity: entity.name },
  }];
};
