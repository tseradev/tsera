import { assertEquals } from "jsr:@std/assert";
import { join } from "../../../shared/path.ts";
import { watchProject } from "../watch.ts";

async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.test("watchProject - détecte la création d'un fichier", async () => {
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
      // Attend que le watcher soit initialisé
      await sleep(100);

      // Crée un fichier
      await Deno.writeTextFile(join(dir, "test.txt"), "content");

      // Attend le debounce + traitement
      await sleep(200);

      // Vérifie qu'un événement a été capturé
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

Deno.test("watchProject - détecte la modification d'un fichier", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier initial
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

      // Modifie le fichier
      await Deno.writeTextFile(join(dir, "test.txt"), "modified");

      await sleep(200);

      // Vérifie qu'un événement modify ou create a été capturé
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

Deno.test("watchProject - détecte la suppression d'un fichier", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier initial
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

      // Supprime le fichier
      await Deno.remove(testFile);

      await sleep(200);

      // Vérifie qu'un événement remove a été capturé
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

Deno.test("watchProject - ignore les fichiers .tsera par défaut", async () => {
  await withTempDir(async (dir) => {
    // Crée le répertoire .tsera AVANT de démarrer le watcher
    const tseraDir = join(dir, ".tsera");
    await Deno.mkdir(tseraDir);

    // Attend un peu pour que le FS se stabilise
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

      // Crée un fichier dans .tsera
      await Deno.writeTextFile(join(tseraDir, "manifest.json"), "{}");

      // Crée un fichier normal
      await Deno.writeTextFile(join(dir, "normal.txt"), "content");

      await sleep(200);

      // Vérifie que le fichier manifest.json dans .tsera n'a PAS été détecté
      const hasManifestEvent = events.some((e) => e.paths.some((p) => p.includes("manifest.json")));
      assertEquals(hasManifestEvent, false);

      // Vérifie que le fichier normal a été détecté
      const hasNormalEvent = events.some((e) => e.paths.some((p) => p.includes("normal.txt")));
      assertEquals(hasNormalEvent, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - ignore les patterns personnalisés", async () => {
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

      // Crée des fichiers à ignorer
      await Deno.mkdir(join(dir, "node_modules"), { recursive: true });
      await Deno.writeTextFile(join(dir, "node_modules", "pkg.json"), "{}");
      await Deno.mkdir(join(dir, "dist"), { recursive: true });
      await Deno.writeTextFile(join(dir, "dist", "bundle.js"), "code");

      // Crée un fichier normal
      await Deno.writeTextFile(join(dir, "src.ts"), "code");

      await sleep(200);

      // Vérifie que seul le fichier src.ts a été détecté
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

Deno.test("watchProject - debounce regroupe les événements", async () => {
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

      // Crée plusieurs fichiers rapidement
      await Deno.writeTextFile(join(dir, "file1.txt"), "1");
      await Deno.writeTextFile(join(dir, "file2.txt"), "2");
      await Deno.writeTextFile(join(dir, "file3.txt"), "3");

      // Attend le debounce
      await sleep(200);

      // Le callback ne devrait être appelé qu'une fois grâce au debounce
      assertEquals(callCount, 1);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - close arrête le watcher", async () => {
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

    // Crée un fichier avant de fermer
    await Deno.writeTextFile(join(dir, "before.txt"), "content");
    await sleep(200);

    const eventsBefore = events.length;
    assertEquals(eventsBefore > 0, true);

    // Ferme le watcher
    controller.close();
    await sleep(100);

    // Crée un fichier après fermeture
    await Deno.writeTextFile(join(dir, "after.txt"), "content");
    await sleep(200);

    // Aucun nouvel événement ne devrait être capturé
    assertEquals(events.length, eventsBefore);
  });
});

Deno.test("watchProject - callback async est attendu", async () => {
  await withTempDir(async (dir) => {
    const processed: string[] = [];

    const controller = watchProject(
      dir,
      async (batch) => {
        // Simule un traitement async
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

      // Attend le debounce + traitement async
      await sleep(300);

      const hasProcessed = processed.some((p) => p.includes("async-test.txt"));
      assertEquals(hasProcessed, true);
    } finally {
      controller.close();
    }
  });
});

Deno.test("watchProject - détecte les modifications dans les sous-répertoires", async () => {
  await withTempDir(async (dir) => {
    // Crée un sous-répertoire
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

      // Crée un fichier dans le sous-répertoire
      await Deno.writeTextFile(join(subDir, "deep.txt"), "content");

      await sleep(200);

      const hasDeepEvent = events.some((e) => e.paths.some((p) => p.includes("deep.txt")));
      assertEquals(hasDeepEvent, true);
    } finally {
      controller.close();
    }
  });
});
