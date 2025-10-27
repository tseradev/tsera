import type { EntityDef } from "tsera/core/entity.ts";
import type { TseraConfig } from "../../contracts/types.ts";
import type { ArtifactDescriptor } from "../dag.ts";

export interface ArtifactContext {
  entity: EntityDef;
  config: TseraConfig;
}

export type ArtifactBuilder = (
  context: ArtifactContext,
) => Promise<ArtifactDescriptor[]> | ArtifactDescriptor[];
