import { assertEquals } from "jsr:@std/assert";
import { join } from "../../../shared/path.ts";
import {
  applySnapshots,
  createEmptyState,
  GRAPH_FILENAME,
  MANIFEST_FILENAME,
  readEngineState,
  snapshotFromNode,
  STATE_DIR,
  writeDagState,
  writeEngineState,
} from "../state.ts";
import type { DagNode } from "../dag.ts";

async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("createEmptyState - crée un état vide", () => {
  const state = createEmptyState();
  
  assertEquals(state.snapshots, {});
});

Deno.test("readEngineState - retourne état vide si manifest n'existe pas", async () => {
  await withTempDir(async (dir) => {
    const state = await readEngineState(dir);
    
    assertEquals(state.snapshots, {});
  });
});

Deno.test("writeEngineState + readEngineState - écrit et lit l'état", async () => {
  await withTempDir(async (dir) => {
    const originalState = {
      snapshots: {
        "entity:User": {
          id: "entity:User",
          kind: "entity" as const,
          hash: "abc123",
          sourcePath: "domain/User.entity.ts",
          label: "User",
        },
      },
    };
    
    await writeEngineState(dir, originalState);
    
    // Vérifie que le fichier existe
    const manifestPath = join(dir, STATE_DIR, MANIFEST_FILENAME);
    const stat = await Deno.stat(manifestPath);
    assertEquals(stat.isFile, true);
    
    // Relit l'état
    const readState = await readEngineState(dir);
    assertEquals(readState, originalState);
  });
});

Deno.test("writeEngineState - crée le répertoire .tsera si nécessaire", async () => {
  await withTempDir(async (dir) => {
    const state = {
      snapshots: {
        "test:1": {
          id: "test:1",
          kind: "entity" as const,
          hash: "xyz",
        },
      },
    };
    
    await writeEngineState(dir, state);
    
    const stateDir = join(dir, STATE_DIR);
    const stat = await Deno.stat(stateDir);
    assertEquals(stat.isDirectory, true);
  });
});

Deno.test("writeEngineState - écrit un JSON valide avec version", async () => {
  await withTempDir(async (dir) => {
    const state = {
      snapshots: {
        "entity:User": {
          id: "entity:User",
          kind: "entity" as const,
          hash: "abc",
        },
      },
    };
    
    await writeEngineState(dir, state);
    
    const manifestPath = join(dir, STATE_DIR, MANIFEST_FILENAME);
    const content = await Deno.readTextFile(manifestPath);
    const parsed = JSON.parse(content);
    
    assertEquals(parsed.version, 1);
    assertEquals(parsed.snapshots["entity:User"].id, "entity:User");
  });
});

Deno.test("writeDagState - écrit le graph.json", async () => {
  await withTempDir(async (dir) => {
    const dag = {
      nodes: new Map<string, DagNode>(),
      edges: [] as { from: string; to: string }[],
      order: [] as DagNode[],
    };
    const node: DagNode = {
      id: "entity:User",
      kind: "entity",
      mode: "input" as const,
      hash: "abc123",
      sourcePath: "domain/User.entity.ts",
      label: "User",
    };
    dag.nodes.set(node.id, node);
    dag.order.push(node);
    
    await writeDagState(dir, dag);
    
    const graphPath = join(dir, STATE_DIR, GRAPH_FILENAME);
    const content = await Deno.readTextFile(graphPath);
    const parsed = JSON.parse(content);
    
    assertEquals(parsed.version, 1);
    assertEquals(parsed.nodes.length, 1);
    assertEquals(parsed.nodes[0].id, "entity:User");
    assertEquals(parsed.edges.length, 0);
  });
});

Deno.test("writeDagState - sérialise les edges", async () => {
  await withTempDir(async (dir) => {
    const dag = {
      nodes: new Map<string, DagNode>(),
      edges: [] as { from: string; to: string }[],
      order: [] as DagNode[],
    };
    const node1: DagNode = {
      id: "entity:User",
      kind: "entity",
      mode: "input" as const,
      hash: "abc",
      label: "User",
    };
    const node2: DagNode = {
      id: "schema:User",
      kind: "schema",
      mode: "output" as const,
      hash: "def",
      label: "User Schema",
    };
    dag.nodes.set(node1.id, node1);
    dag.nodes.set(node2.id, node2);
    dag.edges.push({ from: node1.id, to: node2.id });
    dag.order.push(node1, node2);
    
    await writeDagState(dir, dag);
    
    const graphPath = join(dir, STATE_DIR, GRAPH_FILENAME);
    const content = await Deno.readTextFile(graphPath);
    const parsed = JSON.parse(content);
    
    assertEquals(parsed.edges.length, 1);
    assertEquals(parsed.edges[0].from, "entity:User");
    assertEquals(parsed.edges[0].to, "schema:User");
  });
});

Deno.test("snapshotFromNode - extrait un snapshot d'un node", () => {
  const node: DagNode = {
    id: "entity:User",
    kind: "entity",
    mode: "input",
    hash: "abc123",
    sourcePath: "domain/User.entity.ts",
    targetPath: ".tsera/User.schema.ts",
    label: "User",
  };
  
  const snapshot = snapshotFromNode(node);
  
  assertEquals(snapshot, {
    id: "entity:User",
    kind: "entity",
    hash: "abc123",
    sourcePath: "domain/User.entity.ts",
    targetPath: ".tsera/User.schema.ts",
    label: "User",
  });
});

Deno.test("snapshotFromNode - gère les champs optionnels undefined", () => {
  const node: DagNode = {
    id: "test:1",
    kind: "entity",
    mode: "input",
    hash: "xyz",
    label: "Test",
  };
  
  const snapshot = snapshotFromNode(node);
  
  assertEquals(snapshot.sourcePath, undefined);
  assertEquals(snapshot.targetPath, undefined);
  assertEquals(snapshot.label, "Test");
});

Deno.test("applySnapshots - ajoute des snapshots pour create", () => {
  const state = createEmptyState();
  const node: DagNode = {
    id: "entity:User",
    kind: "entity",
    mode: "input",
    hash: "abc123",
    label: "User",
  };
  
  const nextState = applySnapshots(state, [{ node, action: "create" }]);
  
  assertEquals(nextState.snapshots["entity:User"], {
    id: "entity:User",
    kind: "entity",
    hash: "abc123",
    sourcePath: undefined,
    targetPath: undefined,
    label: "User",
  });
});

Deno.test("applySnapshots - met à jour des snapshots pour update", () => {
  const state = {
    snapshots: {
      "entity:User": {
        id: "entity:User",
        kind: "entity" as const,
        hash: "old",
        label: "User",
      },
    },
  };
  const node: DagNode = {
    id: "entity:User",
    kind: "entity",
    mode: "input",
    hash: "new",
    label: "User",
  };
  
  const nextState = applySnapshots(state, [{ node, action: "update" }]);
  
  assertEquals(nextState.snapshots["entity:User"].hash, "new");
});

Deno.test("applySnapshots - supprime des snapshots pour delete", () => {
  const state = {
    snapshots: {
      "entity:User": {
        id: "entity:User",
        kind: "entity" as const,
        hash: "abc",
        label: "User",
      },
      "entity:Post": {
        id: "entity:Post",
        kind: "entity" as const,
        hash: "def",
        label: "Post",
      },
    },
  };
  const node: DagNode = {
    id: "entity:User",
    kind: "entity",
    mode: "input",
    hash: "abc",
    label: "User",
  };
  
  const nextState = applySnapshots(state, [{ node, action: "delete" }]);
  
  assertEquals(nextState.snapshots["entity:User"], undefined);
  assertEquals(nextState.snapshots["entity:Post"], {
    id: "entity:Post",
    kind: "entity",
    hash: "def",
    label: "Post",
  });
});

Deno.test("applySnapshots - applique plusieurs updates", () => {
  const state = createEmptyState();
  const node1: DagNode = { id: "entity:User", kind: "entity", mode: "input", hash: "a", label: "User" };
  const node2: DagNode = { id: "entity:Post", kind: "entity", mode: "input", hash: "b", label: "Post" };
  
  const nextState = applySnapshots(state, [
    { node: node1, action: "create" },
    { node: node2, action: "create" },
  ]);
  
  assertEquals(Object.keys(nextState.snapshots).length, 2);
  assertEquals(nextState.snapshots["entity:User"].hash, "a");
  assertEquals(nextState.snapshots["entity:Post"].hash, "b");
});

Deno.test("applySnapshots - ne mute pas l'état original", () => {
  const state = {
    snapshots: {
      "entity:User": {
        id: "entity:User",
        kind: "entity" as const,
        hash: "abc",
        label: "User",
      },
    },
  };
  const node: DagNode = { id: "entity:Post", kind: "entity", mode: "input", hash: "def", label: "Post" };
  
  applySnapshots(state, [{ node, action: "create" }]);
  
  // L'état original ne doit pas être modifié
  assertEquals(state.snapshots["entity:Post" as keyof typeof state.snapshots], undefined);
  assertEquals(Object.keys(state.snapshots).length, 1);
});

