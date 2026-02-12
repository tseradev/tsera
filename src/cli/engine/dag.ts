import type { EntityRuntime } from "../../core/entity.ts";
import { pascalToSnakeCase } from "../../core/utils/strings.ts";
import { hashValue } from "./hash.ts";

/**
 * Types of nodes in the dependency graph.
 */
export type DagNodeKind =
  | "entity"
  | "schema"
  | "openapi"
  | "migration"
  | "test"
  | "doc"
  | "drizzle-schema";

/**
 * Node mode indicating whether it's an input (source) or output (generated artifact).
 */
export type DagNodeMode = "input" | "output";

/**
 * Represents a single node in the dependency graph.
 */
export type DagNode = {
  /** Unique identifier for the node. */
  id: string;
  /** Type of node. */
  kind: DagNodeKind;
  /** Whether this is an input or output node. */
  mode: DagNodeMode;
  /** Human-readable label. */
  label: string;
  /** Content hash for change detection. */
  hash: string;
  /** Source file path (for input nodes). */
  sourcePath?: string;
  /** Target file path (for output nodes). */
  targetPath?: string;
  /** Generated content (for output nodes). */
  content?: string | Uint8Array;
  /** Additional metadata. */
  data?: Record<string, unknown>;
};

/**
 * Represents a dependency edge between two nodes.
 */
export type DagEdge = {
  /** Source node identifier. */
  from: string;
  /** Target node identifier. */
  to: string;
};

/**
 * Complete dependency graph structure.
 */
export type Dag = {
  /** Map of node identifiers to node objects. */
  nodes: Map<string, DagNode>;
  /** Array of dependency edges. */
  edges: DagEdge[];
  /** Topologically sorted array of nodes. */
  order: DagNode[];
};

/**
 * Types of generated artifacts (excludes entity input nodes).
 */
export type DagArtifactKind = Exclude<DagNodeKind, "entity">;

/**
 * Describes a generated artifact to be included in the dependency graph.
 */
export type ArtifactDescriptor = {
  /** Type of artifact. */
  kind: DagArtifactKind;
  /** Relative path where the artifact should be written. */
  path: string;
  /** Content to write. */
  content: string | Uint8Array;
  /** Optional metadata. */
  data?: Record<string, unknown>;
  /** Optional human-readable label. */
  label?: string;
  /** Optional dependencies on other node identifiers. */
  dependsOn?: string[];
};

/**
 * Input data for creating a DAG from an entity runtime.
 */
export type DagEntityInput = {
  /** Entity runtime. */
  entity: EntityRuntime;
  /** Source file path of the entity. */
  sourcePath: string;
  /** Artifacts to generate from this entity. */
  artifacts: ArtifactDescriptor[];
};

/**
 * Options for DAG creation.
 */
export type DagOptions = {
  /** CLI version used for hash computation. */
  cliVersion: string;
};

/**
 * Creates a dependency graph from entity inputs and their artifacts.
 *
 * @param inputs - Array of entity inputs with their artifacts.
 * @param options - DAG creation options.
 * @returns A complete dependency graph with topologically sorted nodes.
 */
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

/**
 * Builds a unique identifier for an artifact node.
 *
 * @param artifact - Artifact descriptor.
 * @param entityName - Name of the entity this artifact belongs to.
 * @returns Unique artifact identifier.
 */
export function buildArtifactId(artifact: ArtifactDescriptor, entityName: string): string {
  const slug = pascalToSnakeCase(entityName);
  return `${artifact.kind}:${slug}:${artifact.path}`;
}

/**
 * Performs a topological sort of nodes based on their dependency edges.
 *
 * @param nodes - Map of all nodes in the graph.
 * @param edges - Array of dependency edges.
 * @returns Topologically sorted array of nodes.
 * @throws {Error} If the graph contains cycles or references unknown nodes.
 */
function topologicalSort(nodes: Map<string, DagNode>, edges: DagEdge[]): DagNode[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of nodes.keys()) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }

  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      throw new Error(
        `An edge references an unknown node in the graph: ${edge.from} -> ${edge.to}.`,
      );
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const queue: string[] = [];
  for (const [id, count] of incoming.entries()) {
    if (count === 0) {
      queue.push(id);
    }
  }

  const result: DagNode[] = [];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    const node = nodes.get(id);
    if (!node) {
      continue;
    }
    result.push(node);

    const neighbours = outgoing.get(id);
    if (!neighbours) {
      continue;
    }

    for (const neighbour of neighbours) {
      const nextCount = (incoming.get(neighbour) ?? 0) - 1;
      incoming.set(neighbour, nextCount);
      if (nextCount === 0) {
        queue.push(neighbour);
      }
    }
  }

  if (result.length !== nodes.size) {
    throw new Error("The artifact graph contains a cycle.");
  }

  return result;
}

/**
 * Serialises a DAG into a JSON-friendly format with sorted arrays.
 *
 * @param dag - Dependency graph to serialise.
 * @returns Serialised representation with sorted nodes and edges.
 */
export function serialiseDag(dag: Dag): { nodes: DagNode[]; edges: DagEdge[] } {
  const nodes = Array.from(dag.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  const edges = dag.edges.slice().sort((a, b) => {
    const from = a.from.localeCompare(b.from);
    if (from !== 0) {
      return from;
    }
    return a.to.localeCompare(b.to);
  });

  return { nodes, edges };
}
