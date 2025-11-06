import { join } from "../../shared/path.ts";
import type { Dag, DagEdge, DagNode } from "./dag.ts";
import { serialiseDag } from "./dag.ts";
import { readJsonFile, writeJsonFile } from "../utils/fsx.ts";

export interface SnapshotRecord {
  id: string;
  kind: DagNode["kind"];
  hash: string;
  targetPath?: string;
  sourcePath?: string;
  label?: string;
}

export interface EngineState {
  snapshots: Record<string, SnapshotRecord>;
}

interface ManifestFile {
  version: number;
  snapshots: Record<string, SnapshotRecord>;
}

interface GraphFile {
  version: number;
  nodes: DagNode[];
  edges: DagEdge[];
}

export const STATE_DIR = ".tsera";
export const GRAPH_FILENAME = "graph.json";
export const MANIFEST_FILENAME = "manifest.json";

export function createEmptyState(): EngineState {
  return { snapshots: {} };
}

export async function readEngineState(projectDir: string): Promise<EngineState> {
  const path = join(projectDir, STATE_DIR, MANIFEST_FILENAME);
  const manifest = await readJsonFile<ManifestFile>(path);
  if (!manifest) {
    return createEmptyState();
  }
  return { snapshots: manifest.snapshots ?? {} };
}

export async function writeEngineState(projectDir: string, state: EngineState): Promise<void> {
  const path = join(projectDir, STATE_DIR, MANIFEST_FILENAME);
  const file: ManifestFile = { version: 1, snapshots: state.snapshots };
  await writeJsonFile(path, file);
}

export async function writeDagState(projectDir: string, dag: Dag): Promise<void> {
  const snapshot = serialiseDag(dag);
  const file: GraphFile = { version: 1, nodes: snapshot.nodes, edges: snapshot.edges };
  const path = join(projectDir, STATE_DIR, GRAPH_FILENAME);
  await writeJsonFile(path, file);
}

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
