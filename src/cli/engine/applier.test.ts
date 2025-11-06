import { assertEquals } from "jsr:@std/assert";
import { join } from "../../shared/path.ts";
import { applyPlan } from "./applier.ts";
import type { ApplyStepResult } from "./applier.ts";
import type { PlanStep } from "./planner.ts";
import type { PlanSummary } from "./planner.ts";
import { createEmptyState } from "./state.ts";
import type { DagNode } from "./dag.ts";

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

function createSummary(create = 0, update = 0, deleteCount = 0, noop = 0): PlanSummary {
  const total = create + update + deleteCount + noop;
  const changed = create + update + deleteCount > 0;
  return { create, update, delete: deleteCount, noop, total, changed };
}

Deno.test("applyPlan - create crée un nouveau fichier", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "output.txt",
      content: "Hello, World!",
    };
    
    const plan = {
      steps: [{
        kind: "create" as const,
        node,
      }],
      summary: createSummary(1, 0, 0, 0),
    };
    
    const state = createEmptyState();
    const nextState = await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que le fichier a été créé
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "Hello, World!");
    
    // Vérifie que le snapshot a été ajouté
    assertEquals(nextState.snapshots["test:1"].hash, "abc");
  });
});

Deno.test("applyPlan - update met à jour un fichier existant", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier initial
    await Deno.writeTextFile(join(dir, "output.txt"), "Old content");
    
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "new",
      targetPath: "output.txt",
      content: "New content",
    };
    
    const plan = {
      steps: [{
        kind: "update" as const,
        node,
        previous: {
          id: "test:1",
          kind: "entity" as const,
          hash: "old",
          targetPath: "output.txt",
          label: "Test",
        },
      }],
      summary: createSummary(0, 1, 0, 0),
    };
    
    const state = {
      snapshots: {
        "test:1": {
          id: "test:1",
          kind: "entity" as const,
          hash: "old",
          targetPath: "output.txt",
          label: "Test",
        },
      },
    };
    
    const nextState = await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que le fichier a été mis à jour
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "New content");
    
    // Vérifie que le snapshot a été mis à jour
    assertEquals(nextState.snapshots["test:1"].hash, "new");
  });
});

Deno.test("applyPlan - delete supprime un fichier", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier à supprimer
    await Deno.writeTextFile(join(dir, "output.txt"), "To delete");
    
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "old",
    };
    
    const plan = {
      steps: [{
        kind: "delete" as const,
        node,
        previous: {
          id: "test:1",
          kind: "entity" as const,
          hash: "old",
          targetPath: "output.txt",
          label: "Test",
        },
      }],
      summary: createSummary(0, 0, 1, 0),
    };
    
    const state = {
      snapshots: {
        "test:1": {
          id: "test:1",
          kind: "entity" as const,
          hash: "old",
          targetPath: "output.txt",
          label: "Test",
        },
      },
    };
    
    const nextState = await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que le fichier a été supprimé
    let exists = true;
    try {
      await Deno.stat(join(dir, "output.txt"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        exists = false;
      }
    }
    assertEquals(exists, false);
    
    // Vérifie que le snapshot a été supprimé
    assertEquals(nextState.snapshots["test:1"], undefined);
  });
});

Deno.test("applyPlan - noop ne fait rien", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(join(dir, "output.txt"), "Unchanged");
    
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "output.txt",
      content: "Unchanged",
    };
    
    const plan = {
      steps: [{
        kind: "noop" as const,
        node,
        previous: {
          id: "test:1",
          kind: "entity" as const,
          hash: "abc",
          targetPath: "output.txt",
          label: "Test",
        },
      }],
      summary: createSummary(0, 0, 0, 1),
    };
    
    const state = {
      snapshots: {
        "test:1": {
          id: "test:1",
          kind: "entity" as const,
          hash: "abc",
          targetPath: "output.txt",
          label: "Test",
        },
      },
    };
    
    const nextState = await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que le fichier est toujours là
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "Unchanged");
    
    // Vérifie que l'état n'a pas changé
    assertEquals(nextState.snapshots["test:1"].hash, "abc");
  });
});

Deno.test("applyPlan - callback onStep est appelé", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "output.txt",
      content: "Content",
    };
    
    const plan = {
      steps: [{
        kind: "create" as const,
        node,
      }],
      summary: createSummary(1, 0, 0, 0),
    };
    
    const state = createEmptyState();
    const calls: Array<{ step: PlanStep; result: ApplyStepResult }> = [];
    
    await applyPlan(plan, state, {
      projectDir: dir,
      onStep: (step, result) => {
        calls.push({ step, result });
      },
    });
    
    assertEquals(calls.length, 1);
    assertEquals(calls[0].step.kind, "create");
    assertEquals(calls[0].result.kind, "create");
    assertEquals(calls[0].result.path, "output.txt");
    assertEquals(calls[0].result.changed, true);
  });
});

Deno.test("applyPlan - callback onStep pour noop", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "output.txt",
    };
    
    const plan = {
      steps: [{
        kind: "noop" as const,
        node,
        previous: { id: "test:1", kind: "entity" as const, hash: "abc", label: "Test" },
      }],
      summary: createSummary(0, 0, 0, 1),
    };
    
    const state = createEmptyState();
    const calls: ApplyStepResult[] = [];
    
    await applyPlan(plan, state, {
      projectDir: dir,
      onStep: (_step, result) => {
        calls.push(result);
      },
    });
    
    assertEquals(calls.length, 1);
    assertEquals(calls[0].kind, "noop");
    assertEquals(calls[0].changed, false);
  });
});

Deno.test("applyPlan - applique plusieurs steps dans l'ordre", async () => {
  await withTempDir(async (dir) => {
    const node1: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test 1",
      hash: "a",
      targetPath: "file1.txt",
      content: "File 1",
    };
    const node2: DagNode = {
      id: "test:2",
      kind: "entity",
      mode: "output",
      label: "Test 2",
      hash: "b",
      targetPath: "file2.txt",
      content: "File 2",
    };
    
    const plan = {
      steps: [
        { kind: "create" as const, node: node1 },
        { kind: "create" as const, node: node2 },
      ],
      summary: createSummary(2, 0, 0, 0),
    };
    
    const state = createEmptyState();
    const nextState = await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que les deux fichiers ont été créés
    const content1 = await Deno.readTextFile(join(dir, "file1.txt"));
    const content2 = await Deno.readTextFile(join(dir, "file2.txt"));
    assertEquals(content1, "File 1");
    assertEquals(content2, "File 2");
    
    // Vérifie que les deux snapshots ont été ajoutés
    assertEquals(Object.keys(nextState.snapshots).length, 2);
  });
});

Deno.test("applyPlan - crée les sous-répertoires si nécessaire", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "sub/dir/output.txt",
      content: "Nested file",
    };
    
    const plan = {
      steps: [{
        kind: "create" as const,
        node,
      }],
      summary: createSummary(1, 0, 0, 0),
    };
    
    const state = createEmptyState();
    await applyPlan(plan, state, { projectDir: dir });
    
    // Vérifie que le fichier a été créé avec les sous-répertoires
    const content = await Deno.readTextFile(join(dir, "sub", "dir", "output.txt"));
    assertEquals(content, "Nested file");
  });
});

Deno.test("applyPlan - échoue si node sans targetPath pour create", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      content: "Content",
    };
    
    const plan = {
      steps: [{
        kind: "create" as const,
        node,
      }],
      summary: createSummary(1, 0, 0, 0),
    };
    
    const state = createEmptyState();
    
    let error: Error | null = null;
    try {
      await applyPlan(plan, state, { projectDir: dir });
    } catch (e) {
      error = e as Error;
    }
    
    assertEquals(error !== null, true);
    assertEquals(error?.message.includes("sans chemin de sortie"), true);
  });
});

Deno.test("applyPlan - échoue si node sans content pour create", async () => {
  await withTempDir(async (dir) => {
    const node: DagNode = {
      id: "test:1",
      kind: "entity",
      mode: "output",
      label: "Test",
      hash: "abc",
      targetPath: "output.txt",
    };
    
    const plan = {
      steps: [{
        kind: "create" as const,
        node,
      }],
      summary: createSummary(1, 0, 0, 0),
    };
    
    const state = createEmptyState();
    
    let error: Error | null = null;
    try {
      await applyPlan(plan, state, { projectDir: dir });
    } catch (e) {
      error = e as Error;
    }
    
    assertEquals(error !== null, true);
    assertEquals(error?.message.includes("does not provide content"), true);
  });
});
