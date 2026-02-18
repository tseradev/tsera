import { assertEquals } from "std/assert";
import { join } from "../../../shared/path.ts";
import { watchProject } from "../watch.ts";

async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => { });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.test("watchProject - detects file creation", async () => {
  await withTempDir(async (dir) => {
    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    try {
      // Wait for watcher to be initialized
      await sleep(100);

      // Create a file
      await Deno.writeTextFile(join(dir, "test.txt"), "content");

      // Wait for debounce + processing
      await sleep(200);

      // Verify that an event was captured
      assertEquals(events.length > 0, true);

      const hasCreate = events.some((e) =>
        e.kind === "create" && e.paths.some((p) => p.includes("test.txt"))
      );
      assertEquals(hasCreate, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - detects file modification", async () => {
  await withTempDir(async (dir) => {
    // Create an initial file
    await Deno.writeTextFile(join(dir, "test.txt"), "initial");

    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    try {
      await sleep(100);

      // Modify the file
      await Deno.writeTextFile(join(dir, "test.txt"), "modified");

      await sleep(200);

      // Verify that a modify or create event was captured
      assertEquals(events.length > 0, true);

      const hasModify = events.some((e) =>
        (e.kind === "modify" || e.kind === "create") &&
        e.paths.some((p) => p.includes("test.txt"))
      );
      assertEquals(hasModify, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - detects file deletion", async () => {
  await withTempDir(async (dir) => {
    // Create an initial file
    const testFile = join(dir, "test.txt");
    await Deno.writeTextFile(testFile, "to delete");

    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    try {
      await sleep(100);

      // Delete the file
      await Deno.remove(testFile);

      await sleep(200);

      // Verify that a remove event was captured
      assertEquals(events.length > 0, true);

      const hasRemove = events.some((e) =>
        e.kind === "remove" && e.paths.some((p) => p.includes("test.txt"))
      );
      assertEquals(hasRemove, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - ignores .tsera files by default", async () => {
  await withTempDir(async (dir) => {
    // Create .tsera directory BEFORE starting the watcher
    const tseraDir = join(dir, ".tsera");
    await Deno.mkdir(tseraDir);

    // Wait a bit for FS to stabilize
    await sleep(50);

    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    try {
      await sleep(100);

      // Create a file in .tsera
      await Deno.writeTextFile(join(tseraDir, "manifest.json"), "{}");

      // Create a normal file
      await Deno.writeTextFile(join(dir, "normal.txt"), "content");

      await sleep(200);

      // Verify that manifest.json in .tsera was NOT detected
      const hasManifestEvent = events.some((e) => e.paths.some((p) => p.includes("manifest.json")));
      assertEquals(hasManifestEvent, false);

      // Verify that the normal file was detected
      const hasNormalEvent = events.some((e) => e.paths.some((p) => p.includes("normal.txt")));
      assertEquals(hasNormalEvent, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - ignores custom patterns", async () => {
  await withTempDir(async (dir) => {
    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      {
        debounceMs: 50,
        ignore: [/node_modules/, "dist"],
      },
    );

    try {
      await sleep(100);

      // Create files to ignore
      await Deno.mkdir(join(dir, "node_modules"), { recursive: true });
      await Deno.writeTextFile(join(dir, "node_modules", "pkg.json"), "{}");
      await Deno.mkdir(join(dir, "dist"), { recursive: true });
      await Deno.writeTextFile(join(dir, "dist", "bundle.js"), "code");

      // Create a normal file
      await Deno.writeTextFile(join(dir, "src.ts"), "code");

      await sleep(200);

      // Verify that only src.ts was detected
      const hasIgnoredEvent = events.some((e) =>
        e.paths.some((p) => p.includes("node_modules") || p.includes("dist"))
      );
      assertEquals(hasIgnoredEvent, false);

      const hasSrcEvent = events.some((e) => e.paths.some((p) => p.includes("src.ts")));
      assertEquals(hasSrcEvent, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - debounce groups events", async () => {
  await withTempDir(async (dir) => {
    let callCount = 0;

    const controller = watchProject(
      dir,
      () => {
        callCount++;
      },
      { debounceMs: 100 },
    );

    try {
      await sleep(50);

      // Create multiple files quickly
      await Deno.writeTextFile(join(dir, "file1.txt"), "1");
      await Deno.writeTextFile(join(dir, "file2.txt"), "2");
      await Deno.writeTextFile(join(dir, "file3.txt"), "3");

      // Wait for debounce
      await sleep(200);

      // Callback should only be called once thanks to debounce
      assertEquals(callCount, 1);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - close stops the watcher", async () => {
  await withTempDir(async (dir) => {
    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    await sleep(100);

    // Create a file before closing
    await Deno.writeTextFile(join(dir, "before.txt"), "content");
    await sleep(200);

    const eventsBefore = events.length;
    assertEquals(eventsBefore > 0, true);

    // Close the watcher
    controller.close();
    await sleep(100);

    // Create a file after closing
    await Deno.writeTextFile(join(dir, "after.txt"), "content");
    await sleep(200);

    // No new events should be captured
    assertEquals(events.length, eventsBefore);
  });
});

Deno.test("watchProject - async callback is awaited", async () => {
  await withTempDir(async (dir) => {
    const processed: string[] = [];

    const controller = watchProject(
      dir,
      async (batch) => {
        // Simulate async processing
        await sleep(50);
        for (const event of batch) {
          for (const path of event.paths) {
            processed.push(path);
          }
        }
      },
      { debounceMs: 50 },
    );

    try {
      await sleep(100);

      await Deno.writeTextFile(join(dir, "async-test.txt"), "content");

      // Wait for debounce + async processing
      await sleep(300);

      const hasProcessed = processed.some((p) => p.includes("async-test.txt"));
      assertEquals(hasProcessed, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - detects modifications in subdirectories", async () => {
  await withTempDir(async (dir) => {
    // Create a subdirectory
    const subDir = join(dir, "sub", "nested");
    await Deno.mkdir(subDir, { recursive: true });

    const events: Deno.FsEvent[] = [];

    const controller = watchProject(
      dir,
      (batch) => {
        events.push(...batch);
      },
      { debounceMs: 50 },
    );

    try {
      await sleep(100);

      // Create a file in the subdirectory
      await Deno.writeTextFile(join(subDir, "deep.txt"), "content");

      await sleep(200);

      const hasDeepEvent = events.some((e) => e.paths.some((p) => p.includes("deep.txt")));
      assertEquals(hasDeepEvent, true);
    } finally {
      controller.close();
    }
  });
});
