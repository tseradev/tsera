import { assertEquals, assertExists } from "std/assert";
import { join } from "../../../shared/path.ts";
import { ensureDir, pathExists } from "../../utils/fsx.ts";
import { handleDeploySync } from "./deploy-sync.ts";
import { updateDeployTargets } from "../../utils/deploy-config.ts";
import { readWorkflowsMeta } from "./utils/workflow-meta.ts";

Deno.test("deploy-sync: creates workflows for enabled providers", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-deploy-test-" });
  try {
    // Setup: create config directory and tsera.config.ts
    const configDir = join(testDir, "config");
    await ensureDir(configDir);
    const configPath = join(configDir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `import type { TseraConfig } from "tsera/cli/definitions.ts";
const config: TseraConfig = {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "postgres", urlEnv: "DATABASE_URL", ssl: "prefer" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
  deployTargets: ["docker"],
};
export default config;`,
    );

    // Create CD source workflow
    const cdDir = join(configDir, "cd", "docker");
    await ensureDir(cdDir);
    await Deno.writeTextFile(
      join(cdDir, "staging.yml"),
      `name: CD Docker Staging
on:
  workflow_call: {}`,
    );

    // Run sync
    await handleDeploySync({
      projectDir: testDir,
      force: false,
      global: { json: false },
    });

    // Verify workflow was created
    const workflowPath = join(testDir, ".github", "workflows", "cd-docker-staging.yml");
    assertEquals(await pathExists(workflowPath), true);

    // Verify meta was updated
    const meta = await readWorkflowsMeta(testDir);
    assertExists(meta[".github/workflows/cd-docker-staging.yml"]);
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => { });
  }
});

Deno.test("deploy-sync: removes workflows for disabled providers", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-deploy-test-" });
  try {
    // Setup: create config with docker enabled
    const configDir = join(testDir, "config");
    await ensureDir(configDir);
    const configPath = join(configDir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `import type { TseraConfig } from "tsera/cli/definitions.ts";
const config: TseraConfig = {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "postgres", urlEnv: "DATABASE_URL", ssl: "prefer" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
  deployTargets: ["docker"],
};
export default config;`,
    );

    // Create CD source workflow
    const cdDir = join(configDir, "cd", "docker");
    await ensureDir(cdDir);
    await Deno.writeTextFile(
      join(cdDir, "staging.yml"),
      `name: CD Docker Staging
on:
  workflow_call: {}`,
    );

    // Create .tsera directory and workflows-meta.json
    const tseraDir = join(testDir, ".tsera");
    await ensureDir(tseraDir);
    await Deno.writeTextFile(
      join(tseraDir, "workflows-meta.json"),
      JSON.stringify({
        ".github/workflows/cd-docker-staging.yml": "sha256-test",
      }, null, 2),
    );

    // Create the workflow file
    const workflowDir = join(testDir, ".github", "workflows");
    await ensureDir(workflowDir);
    await Deno.writeTextFile(
      join(workflowDir, "cd-docker-staging.yml"),
      `name: CD Docker Staging
on:
  workflow_call: {}`,
    );

    // Disable docker provider
    await updateDeployTargets(testDir, []);

    // Run sync
    await handleDeploySync({
      projectDir: testDir,
      force: false,
      global: { json: false },
    });

    // Verify workflow was removed
    const workflowPath = join(workflowDir, "cd-docker-staging.yml");
    assertEquals(await pathExists(workflowPath), false);

    // Verify meta was cleaned
    const meta = await readWorkflowsMeta(testDir);
    assertEquals(meta[".github/workflows/cd-docker-staging.yml"], undefined);
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => { });
  }
});

