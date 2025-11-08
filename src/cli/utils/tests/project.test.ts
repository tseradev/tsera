import { assertEquals, assertRejects } from "@std/assert";
import { join } from "../../../shared/path.ts";
import { findConfigPath, resolveProject } from "../project.ts";

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

Deno.test("findConfigPath - trouve le config à la racine", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const found = await findConfigPath(dir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - trouve le config dans un sous-répertoire", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Crée un sous-répertoire
    const subDir = join(dir, "src", "domain");
    await Deno.mkdir(subDir, { recursive: true });

    // Cherche depuis le sous-répertoire
    const found = await findConfigPath(subDir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - remonte plusieurs niveaux", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Crée un sous-répertoire profond
    const deepDir = join(dir, "a", "b", "c", "d");
    await Deno.mkdir(deepDir, { recursive: true });

    // Cherche depuis le répertoire profond
    const found = await findConfigPath(deepDir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - retourne null si config non trouvé", async () => {
  await withTempDir(async (dir) => {
    const found = await findConfigPath(dir);

    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - s'arrête à la racine du système", async () => {
  await withTempDir(async (dir) => {
    // Ne crée pas de config
    const found = await findConfigPath(dir);

    // Devrait retourner null sans boucler infiniment
    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - préfère le config le plus proche", async () => {
  await withTempDir(async (dir) => {
    // Crée un config à la racine
    const rootConfig = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(rootConfig, "export default { root: true }");

    // Crée un sous-répertoire avec son propre config
    const subDir = join(dir, "sub");
    await Deno.mkdir(subDir);
    const subConfig = join(subDir, "tsera.config.ts");
    await Deno.writeTextFile(subConfig, "export default { sub: true }");

    // Cherche depuis le sous-répertoire
    const found = await findConfigPath(subDir);

    // Devrait trouver le config du sous-répertoire, pas celui de la racine
    assertEquals(found, subConfig);
  });
});

Deno.test("resolveProject - retourne rootDir et configPath", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(dir);

    assertEquals(result.rootDir, dir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - rootDir est le répertoire du config", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Crée un sous-répertoire
    const subDir = join(dir, "src");
    await Deno.mkdir(subDir);

    // Résout depuis le sous-répertoire
    const result = await resolveProject(subDir);

    // Le rootDir devrait être le répertoire contenant le config, pas subDir
    assertEquals(result.rootDir, dir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - échoue si config non trouvé", async () => {
  await withTempDir(async (dir) => {
    await assertRejects(
      async () => {
        await resolveProject(dir);
      },
      Error,
      "Unable to find tsera.config.ts",
    );
  });
});

Deno.test("resolveProject - message d'erreur inclut le répertoire de départ", async () => {
  await withTempDir(async (dir) => {
    try {
      await resolveProject(dir);
      throw new Error("Should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      assertEquals(message.includes(dir), true);
    }
  });
});

Deno.test("resolveProject - gère les chemins avec espaces", async () => {
  await withTempDir(async (dir) => {
    // Crée un sous-répertoire avec espaces
    const spacedDir = join(dir, "my project");
    await Deno.mkdir(spacedDir);

    const configPath = join(spacedDir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(spacedDir);

    assertEquals(result.rootDir, spacedDir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - gère les chemins avec caractères spéciaux", async () => {
  await withTempDir(async (dir) => {
    // Crée un sous-répertoire avec caractères spéciaux
    const specialDir = join(dir, "project-2024");
    await Deno.mkdir(specialDir);

    const configPath = join(specialDir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(specialDir);

    assertEquals(result.rootDir, specialDir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("findConfigPath - ne trouve pas tsera.config.js", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier JS au lieu de TS
    await Deno.writeTextFile(join(dir, "tsera.config.js"), "module.exports = {}");

    const found = await findConfigPath(dir);

    // Ne devrait pas trouver le fichier JS
    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - ne trouve pas config.ts", async () => {
  await withTempDir(async (dir) => {
    // Crée un fichier avec un nom différent
    await Deno.writeTextFile(join(dir, "config.ts"), "export default {}");

    const found = await findConfigPath(dir);

    // Ne devrait pas trouver ce fichier
    assertEquals(found, null);
  });
});
