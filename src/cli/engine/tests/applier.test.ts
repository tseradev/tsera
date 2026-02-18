import { assertEquals } from "std/assert";
import { join } from "../../../shared/path.ts";
import type { ApplyStepResult } from "../applier.ts";
import { applyPlan } from "../applier.ts";
import type { DagNode } from "../dag.ts";
import type { PlanStep, PlanSummary } from "../planner.ts";
import { createEmptyState } from "../state.ts";

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

Deno.test("applyPlan - create creates a new file", async () => {
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

    // Verify that the file was created
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "Hello, World!");

    // Verify that the snapshot was added
    assertEquals(nextState.snapshots["test:1"].hash, "abc");
  });
});

Deno.test("applyPlan - update updates an existing file", async () => {
  await withTempDir(async (dir) => {
    // Create an initial file
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

    // Verify that the file was updated
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "New content");

    // Verify that the snapshot was updated
    assertEquals(nextState.snapshots["test:1"].hash, "new");
  });
});

Deno.test("applyPlan - delete deletes a file", async () => {
  await withTempDir(async (dir) => {
    // Create a file to delete
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

    // Verify that the file was deleted
    let exists = true;
    try {
      await Deno.stat(join(dir, "output.txt"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        exists = false;
      }
    }
    assertEquals(exists, false);

    // Verify that the snapshot was deleted
    assertEquals(nextState.snapshots["test:1"], undefined);
  });
});

Deno.test("applyPlan - noop does nothing", async () => {
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

    // Verify that the file is still there
    const content = await Deno.readTextFile(join(dir, "output.txt"));
    assertEquals(content, "Unchanged");

    // Verify that the state has not changed
    assertEquals(nextState.snapshots["test:1"].hash, "abc");
  });
});

Deno.test("applyPlan - onStep callback is called", async () => {
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

Deno.test("applyPlan - onStep callback for noop", async () => {
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

Deno.test("applyPlan - applies multiple steps in order", async () => {
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

    // Verify that both files were created
    const content1 = await Deno.readTextFile(join(dir, "file1.txt"));
    const content2 = await Deno.readTextFile(join(dir, "file2.txt"));
    assertEquals(content1, "File 1");
    assertEquals(content2, "File 2");

    // Verify that both snapshots were added
    assertEquals(Object.keys(nextState.snapshots).length, 2);
  });
});

Deno.test("applyPlan - creates subdirectories if necessary", async () => {
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

    // Verify that the file was created with subdirectories
    const content = await Deno.readTextFile(join(dir, "sub", "dir", "output.txt"));
    assertEquals(content, "Nested file");
  });
});

Deno.test("applyPlan - fails if node without targetPath for create", async () => {
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
    assertEquals(error?.message.includes("without an output path"), true);
  });
});

Deno.test("applyPlan - fails if node without content for create", async () => {
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
