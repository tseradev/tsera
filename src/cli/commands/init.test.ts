import { join } from "../../shared/path.ts";
import { createDefaultInitHandler } from "./init.ts";
import { assert, assertEquals } from "../../testing/asserts.ts";

const NOOP_WRITER = () => {};

async function readGoldenFile(name: string): Promise<string> {
  const url = new URL(`./__tests__/__golden__/${name}`, import.meta.url);
  return await Deno.readTextFile(url);
}

Deno.test("init generates the full skeleton and manifest", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "demo-app");
    const handler = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });

    await handler({
      directory: projectDir,
      template: "app-minimal",
      force: false,
      yes: true,
      global: { json: false, strict: false },
    });

    const configPath = join(projectDir, "tsera.config.ts");
    const config = await Deno.readTextFile(configPath);
    const expectedConfig = await readGoldenFile("tsera.config.ts");
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
