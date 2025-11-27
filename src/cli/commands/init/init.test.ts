import { join } from "../../../shared/path.ts";
import { normalizeNewlines } from "../../../shared/newline.ts";
import { createDefaultInitHandler } from "./init.ts";
import { assert, assertEquals } from "std/assert";

const NOOP_WRITER = () => {};

async function readGoldenFile(name: string): Promise<string> {
  const url = new URL(`./__golden__/${name}`, import.meta.url);
  return await Deno.readTextFile(url);
}

async function updateImportMapForTests(projectDir: string): Promise<void> {
  const srcPath = join(Deno.cwd(), "src");
  const normalizedSrcPath = srcPath.replace(/\\/g, "/");
  
  // Check if import_map.json exists (non-Fresh projects)
  const importMapPath = join(projectDir, "import_map.json");
  if (await fileExists(importMapPath)) {
    const importMap = JSON.parse(await Deno.readTextFile(importMapPath));
    if (!importMap.imports) {
      importMap.imports = {};
    }
    importMap.imports["tsera/"] = `file://${normalizedSrcPath}/`;
    importMap.imports["tsera/core/"] = `file://${normalizedSrcPath}/core/`;
    importMap.imports["tsera/cli/"] = `file://${normalizedSrcPath}/cli/`;
    await Deno.writeTextFile(importMapPath, JSON.stringify(importMap, null, 2));
  } else {
    // Fresh projects: imports are in deno.jsonc
    const denoConfigPath = join(projectDir, "deno.jsonc");
    if (await fileExists(denoConfigPath)) {
      const { parse } = await import("jsr:@std/jsonc@1");
      const denoConfig = parse(await Deno.readTextFile(denoConfigPath)) as {
        imports?: Record<string, string>;
      };
      if (!denoConfig.imports) {
        denoConfig.imports = {};
      }
      denoConfig.imports["tsera/"] = `file://${normalizedSrcPath}/`;
      denoConfig.imports["tsera/core/"] = `file://${normalizedSrcPath}/core/`;
      denoConfig.imports["tsera/cli/"] = `file://${normalizedSrcPath}/cli/`;
      await Deno.writeTextFile(denoConfigPath, JSON.stringify(denoConfig, null, 2) + "\n");
    }
  }
}

Deno.test("init generates the full skeleton and manifest", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "demo-app");
    const handler = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });

    await handler({
      directory: projectDir,
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        fresh: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const configPath = join(projectDir, "config", "tsera.config.ts");
    const config = normalizeNewlines(await Deno.readTextFile(configPath), "\n");
    const expectedConfig = normalizeNewlines(await readGoldenFile("tsera.config.ts"), "\n");
    assertEquals(config, expectedConfig);

    const gitignore = await Deno.readTextFile(join(projectDir, ".gitignore"));
    assert(gitignore.includes(".tsera/"));

    const openapiPath = join(projectDir, ".tsera", "openapi.json");
    const openapiDocument = await Deno.readTextFile(openapiPath);
    const expectedOpenapi = await readGoldenFile("openapi.json");

    // Compare parsed JSON to ignore platform-specific newline differences while
    // still validating the structure and values of the generated document.
    const openapiObject = JSON.parse(openapiDocument);
    const expectedOpenapiObject = JSON.parse(expectedOpenapi);
    assertEquals(openapiObject, expectedOpenapiObject);

    const manifestText = await Deno.readTextFile(join(projectDir, ".tsera", "manifest.json"));
    const manifest = JSON.parse(manifestText) as { snapshots?: Record<string, unknown> };
    assert(manifest.snapshots !== undefined);

    const graphExists = await fileExists(join(projectDir, ".tsera", "graph.json"));
    assert(graphExists);

    const templateReadme = await Deno.readTextFile(join(projectDir, "README.md"));
    assert(templateReadme.length > 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}
