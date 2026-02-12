import type { EntityRuntime } from "../../../core/entity.ts";
import type { TseraConfig } from "../../definitions.ts";
import type { ArtifactDescriptor } from "../dag.ts";

/**
 * Context provided to artifact builders.
 */
export type ArtifactContext = {
  /** Entity runtime to generate artifacts for. */
  entity: EntityRuntime;
  /** TSera configuration. */
  config: TseraConfig;
  /** Project root directory. */
  projectDir: string;
};

/**
 * Function that builds artifact descriptors from an entity context.
 */
export type ArtifactBuilder = (
  context: ArtifactContext,
) => Promise<ArtifactDescriptor[]> | ArtifactDescriptor[];
