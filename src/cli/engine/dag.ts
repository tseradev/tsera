/**
 * Graph primitives describing relationships between entities and derived
 * artefacts. The implementation stays intentionally lightweight for the
 * scaffolding phase.
 */

export type DagNodeType = "entity" | "schema" | "openapi" | "migration" | "test" | "doc";

export interface DagNode {
  id: string;
  type: DagNodeType;
  dependsOn: string[];
}

export interface DagGraph {
  nodes: DagNode[];
}

export function createEmptyGraph(): DagGraph {
  return { nodes: [] };
}
