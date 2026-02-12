import { join } from "../../shared/path.ts";
import type { Dag, DagEdge, DagNode } from "./dag.ts";
import { serialiseDag } from "./dag.ts";
import { readJsonFile, writeJsonFile } from "../utils/fsx.ts";

/**
 * Snapshot record representing the state of a node at a point in time.
 */
export type SnapshotRecord = {
  /** Unique node identifier. */
  id: string;
  /** Type of node. */
  kind: DagNode["kind"];
  /** Content hash. */
  hash: string;
  /** Target file path (for output nodes). */
  targetPath?: string;
  /** Source file path (for input nodes). */
  sourcePath?: string;
  /** Human-readable label. */
  label?: string;
};

/**
 * Complete engine state tracking all node snapshots.
 */
export type EngineState = {
  /** Map of node identifiers to their snapshot records. */
  snapshots: Record<string, SnapshotRecord>;
};

type ManifestFile = {
  version: number;
  snapshots: Record<string, SnapshotRecord>;
};

type GraphFile = {
  version: number;
  nodes: DagNode[];
  edges: DagEdge[];
};

/** Directory where engine state files are stored. */
export const STATE_DIR = ".tsera";
/** Filename for the dependency graph JSON file. */
export const GRAPH_FILENAME = "graph.json";
/** Filename for the manifest JSON file. */
export const MANIFEST_FILENAME = "manifest.json";

/**
 * Creates an empty engine state.
 *
 * @returns Empty engine state with no snapshots.
 */
export function createEmptyState(): EngineState {
  return { snapshots: {} };
}

/**
 * Reads the engine state from disk.
 *
 * @param projectDir - Project root directory.
 * @returns Engine state, or empty state if no manifest exists.
 */
export async function readEngineState(projectDir: string): Promise<EngineState> {
  const path = join(projectDir, STATE_DIR, MANIFEST_FILENAME);
  const manifest = await readJsonFile<ManifestFile>(path);
  if (!manifest) {
    return createEmptyState();
  }
  return { snapshots: manifest.snapshots ?? {} };
}

/**
 * Writes the engine state to disk.
 *
 * @param projectDir - Project root directory.
 * @param state - Engine state to persist.
 */
export async function writeEngineState(projectDir: string, state: EngineState): Promise<void> {
  const path = join(projectDir, STATE_DIR, MANIFEST_FILENAME);
  const file: ManifestFile = { version: 1, snapshots: state.snapshots };
  await writeJsonFile(path, file);
}

/**
 * Writes the dependency graph state to disk.
 *
 * @param projectDir - Project root directory.
 * @param dag - Dependency graph to persist.
 */
export async function writeDagState(projectDir: string, dag: Dag): Promise<void> {
  const snapshot = serialiseDag(dag);
  const file: GraphFile = { version: 1, nodes: snapshot.nodes, edges: snapshot.edges };
  const path = join(projectDir, STATE_DIR, GRAPH_FILENAME);
  await writeJsonFile(path, file);
}

/**
 * Creates a snapshot record from a DAG node.
 *
 * @param node - DAG node to snapshot.
 * @returns Snapshot record.
 */
export function snapshotFromNode(node: DagNode): SnapshotRecord {
  return {
    id: node.id,
    kind: node.kind,
    hash: node.hash,
    targetPath: node.targetPath,
    sourcePath: node.sourcePath,
    label: node.label,
  };
}

/**
 * Applies a set of node updates to the engine state.
 *
 * @param state - Current engine state.
 * @param updates - Array of node updates to apply.
 * @returns Updated engine state.
 */
export function applySnapshots(
  state: EngineState,
  updates: { node: DagNode; action: "create" | "update" | "delete" }[],
): EngineState {
  const next: EngineState = {
    snapshots: { ...state.snapshots },
  };

  for (const update of updates) {
    if (update.action === "delete") {
      delete next.snapshots[update.node.id];
      continue;
    }
    next.snapshots[update.node.id] = snapshotFromNode(update.node);
  }

  return next;
}
