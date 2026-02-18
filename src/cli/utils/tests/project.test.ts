import { assertEquals, assertRejects } from "std/assert";
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

Deno.test("findConfigPath - finds config at root", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const configPath = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const found = await findConfigPath(dir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - finds config from subdirectory", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const configPath = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Create a subdirectory
    const subDir = join(dir, "src", "domain");
    await Deno.mkdir(subDir, { recursive: true });

    // Search from subdirectory
    const found = await findConfigPath(subDir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - traverses multiple levels", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const configPath = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Create a deep subdirectory
    const deepDir = join(dir, "a", "b", "c", "d");
    await Deno.mkdir(deepDir, { recursive: true });

    // Search from deep directory
    const found = await findConfigPath(deepDir);

    assertEquals(found, configPath);
  });
});

Deno.test("findConfigPath - returns null if config not found", async () => {
  await withTempDir(async (dir) => {
    const found = await findConfigPath(dir);

    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - stops at system root", async () => {
  await withTempDir(async (dir) => {
    // Don't create config
    const found = await findConfigPath(dir);

    // Should return null without infinite loop
    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - prefers closest config", async () => {
  await withTempDir(async (dir) => {
    // Create config at root
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const rootConfig = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(rootConfig, "export default { root: true }");

    // Create subdirectory with its own config
    const subDir = join(dir, "sub");
    await Deno.mkdir(join(subDir, "config"), { recursive: true });
    const subConfig = join(subDir, "config", "tsera.config.ts");
    await Deno.writeTextFile(subConfig, "export default { sub: true }");

    // Search from subdirectory
    const found = await findConfigPath(subDir);

    // Should find subdirectory config, not root config
    assertEquals(found, subConfig);
  });
});

Deno.test("resolveProject - returns rootDir and configPath", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const configPath = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(dir);

    assertEquals(result.rootDir, dir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - rootDir is config directory", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    const configPath = join(dir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    // Create a subdirectory
    const subDir = join(dir, "src");
    await Deno.mkdir(subDir);

    // Resolve from subdirectory
    const result = await resolveProject(subDir);

    // rootDir should be the directory containing config, not subDir
    assertEquals(result.rootDir, dir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - fails if config not found", async () => {
  await withTempDir(async (dir) => {
    await assertRejects(
      async () => {
        await resolveProject(dir);
      },
      Error,
      "Unable to find config/tsera.config.ts",
    );
  });
});

Deno.test("resolveProject - error message includes starting directory", async () => {
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

Deno.test("resolveProject - handles paths with spaces", async () => {
  await withTempDir(async (dir) => {
    // Create subdirectory with spaces
    const spacedDir = join(dir, "my project");
    await Deno.mkdir(join(spacedDir, "config"), { recursive: true });

    const configPath = join(spacedDir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(spacedDir);

    assertEquals(result.rootDir, spacedDir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("resolveProject - handles paths with special characters", async () => {
  await withTempDir(async (dir) => {
    // Create subdirectory with special characters
    const specialDir = join(dir, "project-2024");
    await Deno.mkdir(join(specialDir, "config"), { recursive: true });

    const configPath = join(specialDir, "config", "tsera.config.ts");
    await Deno.writeTextFile(configPath, "export default {}");

    const result = await resolveProject(specialDir);

    assertEquals(result.rootDir, specialDir);
    assertEquals(result.configPath, configPath);
  });
});

Deno.test("findConfigPath - does not find tsera.config.js", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    // Create JS file instead of TS
    await Deno.writeTextFile(join(dir, "config", "tsera.config.js"), "export default {}");

    const found = await findConfigPath(dir);

    // Should not find JS file
    assertEquals(found, null);
  });
});

Deno.test("findConfigPath - does not find config.ts", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(join(dir, "config"), { recursive: true });
    // Create file with different name
    await Deno.writeTextFile(join(dir, "config.ts"), "export default {}");

    const found = await findConfigPath(dir);

    // Should not find this file
    assertEquals(found, null);
  });
});
