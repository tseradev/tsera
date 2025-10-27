import type { EntityDef } from "tsera/core/entity.ts";
import { pascalToSnakeCase } from "tsera/core/utils/strings.ts";
import { hashValue } from "./hash.ts";

export type DagNodeKind = "entity" | "schema" | "openapi" | "migration" | "test" | "doc";

export type DagNodeMode = "input" | "output";

export interface DagNode {
  id: string;
  kind: DagNodeKind;
  mode: DagNodeMode;
  label: string;
  hash: string;
  sourcePath?: string;
  targetPath?: string;
  content?: string | Uint8Array;
  data?: Record<string, unknown>;
}

export interface DagEdge {
  from: string;
  to: string;
}

export interface Dag {
  nodes: Map<string, DagNode>;
  edges: DagEdge[];
  order: DagNode[];
}

export type DagArtifactKind = Exclude<DagNodeKind, "entity">;

export interface ArtifactDescriptor {
  kind: DagArtifactKind;
  path: string;
  content: string | Uint8Array;
  data?: Record<string, unknown>;
  label?: string;
  dependsOn?: string[];
}

export interface DagEntityInput {
  entity: EntityDef;
  sourcePath: string;
  artifacts: ArtifactDescriptor[];
}

export interface DagOptions {
  cliVersion: string;
}

export async function createDag(
  inputs: DagEntityInput[],
  options: DagOptions,
): Promise<Dag> {
  const nodes = new Map<string, DagNode>();
  const edges: DagEdge[] = [];

  for (const input of inputs) {
    const entityId = `entity:${input.entity.name}`;
    const entityNode: DagNode = {
      id: entityId,
      kind: "entity",
      mode: "input",
      label: input.entity.name,
      sourcePath: input.sourcePath,
      hash: await hashValue({
        entity: input.entity,
        sourcePath: input.sourcePath,
      }, { version: options.cliVersion, salt: "entity" }),
      data: { entity: input.entity },
    };
    nodes.set(entityId, entityNode);

    for (const artifact of input.artifacts) {
      const artifactId = buildArtifactId(artifact, input.entity.name);
      const artifactNode: DagNode = {
        id: artifactId,
        kind: artifact.kind,
        mode: "output",
        label: artifact.label ?? `${input.entity.name} ${artifact.kind}`,
        targetPath: artifact.path,
        content: artifact.content,
        data: artifact.data,
        hash: await hashValue({
          path: artifact.path,
          content: artifact.content,
          entity: input.entity.name,
        }, { version: options.cliVersion, salt: artifact.kind }),
      };
      nodes.set(artifactId, artifactNode);
      edges.push({ from: entityId, to: artifactId });

      if (artifact.dependsOn) {
        for (const dependency of artifact.dependsOn) {
          edges.push({ from: dependency, to: artifactId });
        }
      }
    }
  }

  const order = topologicalSort(nodes, edges);

  return { nodes, edges, order };
}

function buildArtifactId(artifact: ArtifactDescriptor, entityName: string): string {
  const slug = pascalToSnakeCase(entityName);
  return `${artifact.kind}:${slug}:${artifact.path}`;
}

function topologicalSort(nodes: Map<string, DagNode>, edges: DagEdge[]): DagNode[] {
  const incoming = new Map<string, number>();
  for (const id of nodes.keys()) {
    incoming.set(id, 0);
  }
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, count] of incoming.entries()) {
    if (count === 0) {
      queue.push(id);
    }
  }

  const result: DagNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.get(id);
    if (!node) {
      continue;
    }
    result.push(node);

    for (const edge of edges) {
      if (edge.from === id) {
        const nextCount = (incoming.get(edge.to) ?? 0) - 1;
        incoming.set(edge.to, nextCount);
        if (nextCount === 0) {
          queue.push(edge.to);
        }
      }
    }
  }

  if (result.length !== nodes.size) {
    throw new Error("Le graphe des artefacts contient un cycle.");
  }

  return result;
}

export function serialiseDag(dag: Dag): { nodes: DagNode[]; edges: DagEdge[] } {
  return {
    nodes: Array.from(dag.nodes.values()),
    edges: dag.edges,
  };
}
