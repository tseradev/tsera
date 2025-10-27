import { join } from "../../shared/path.ts";
import { createDefaultInitHandler } from "./init.ts";
import { assert } from "../../testing/asserts.ts";

const NOOP_WRITER = () => {};

Deno.test("init génère le squelette complet et le manifeste", async () => {
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
    assert(config.includes('projectName: "DemoApp"'));
    assert(config.includes("deploy: ["));

    const gitignore = await Deno.readTextFile(join(projectDir, ".gitignore"));
    assert(gitignore.includes(".tsera/"));

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
