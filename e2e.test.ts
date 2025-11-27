import { join } from "./src/shared/path.ts";
import { assert } from "std/assert";

interface RunCliOptions {
  cwd: string;
}

interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

interface LogEvent {
  level: string;
  message: string;
  event?: string;
  context?: Record<string, unknown>;
}

const CLI_ENTRY = join(Deno.cwd(), "src", "cli", "main.ts");

async function runCli(args: string[], options: RunCliOptions): Promise<CliResult> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI_ENTRY, ...args],
    cwd: options.cwd,
    stdout: "piped",
    stderr: "piped",
    stdin: "null", // Close stdin to prevent interactive prompts from blocking
    env: {
      DENO_NO_PROMPT: "1",
    },
  });

  const output = await command.output();
  const decoder = new TextDecoder();
  return {
    success: output.success,
    stdout: decoder.decode(output.stdout),
    stderr: decoder.decode(output.stderr),
  };
}

function parseNdjson(text: string): LogEvent[] {
  return text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LogEvent);
}

function findEvent(events: LogEvent[], name: string): LogEvent | undefined {
  return events.find((event) => event.event === name || event.message === name);
}

async function exists(path: string): Promise<boolean> {
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

Deno.test("E2E: basic init with all modules", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo-full");

  try {
    const initResult = await runCli(["init", "demo-full", "--yes"], { cwd: workspace });
    if (!initResult.success) {
      throw new Error(`Init failed: ${initResult.stderr}`);
    }

    // Check core files
    assert(await exists(join(projectDir, "config", "tsera.config.ts")), "Config missing");
    assert(await exists(join(projectDir, "core", "entities", "User.ts")), "Entity missing");

    // Check Hono module
    assert(await exists(join(projectDir, "app", "back", "main.ts")), "Hono main.ts missing");
    assert(await exists(join(projectDir, "app", "back", "routes", "health.ts")), "Health route missing");

    // Check Fresh module
    assert(await exists(join(projectDir, "app", "front", "main.ts")), "Fresh main.ts missing");
    assert(
      await exists(join(projectDir, "app", "front", "components", "Counter.tsx")),
      "Counter component missing",
    );

    // Check Docker module
    assert(await exists(join(projectDir, "config", "docker", "docker-compose.yml")), "docker-compose.yml missing");
    assert(await exists(join(projectDir, "config", "docker", "Dockerfile.back")), "Dockerfile.back missing");
    assert(await exists(join(projectDir, "config", "docker", "Dockerfile.front")), "Dockerfile.front missing");

    // Check CI module
    assert(await exists(join(projectDir, ".github", "workflows", "ci-lint.yml")), "CI lint workflow missing");
    assert(await exists(join(projectDir, ".github", "workflows", "ci-test.yml")), "CI test workflow missing");

    // Check Secrets module
    assert(await exists(join(projectDir, "config", "secrets", "manager.ts")), "manager.ts missing");
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("E2E: selective module disabling", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo-minimal");

  try {
    const initResult = await runCli([
      "init",
      "demo-minimal",
      "--no-fresh",
      "--no-docker",
      "--no-ci",
      "--yes",
    ], { cwd: workspace });

    if (!initResult.success) {
      throw new Error(`Init with flags failed: ${initResult.stderr}`);
    }

    // Check that base and enabled modules exist
    assert(await exists(join(projectDir, "config", "tsera.config.ts")), "Config missing");
    assert(await exists(join(projectDir, "app", "back", "main.ts")), "Hono should be present");
    assert(await exists(join(projectDir, "config", "secrets", "manager.ts")), "Secrets should be present");

    // Check that disabled modules don't exist
    assert(!await exists(join(projectDir, "app", "front")), "Fresh should be disabled");
    assert(!await exists(join(projectDir, "config", "docker")), "Docker should be disabled");
    assert(!await exists(join(projectDir, ".github")), "CI should be disabled");
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("E2E: coherence and artifact generation", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo-coherence");

  try {
    const initResult = await runCli(["init", "demo-coherence", "--yes"], { cwd: workspace });
    if (!initResult.success) {
      throw new Error(`Init failed: ${initResult.stderr}`);
    }

    const schemaPath = join(projectDir, ".tsera", "schemas", "User.schema.ts");
    const docPath = join(projectDir, "docs", "markdown", "User.md");

    assert(await exists(schemaPath), "Schema not generated");
    assert(await exists(docPath), "Documentation not generated");

    const firstDev = await runCli(["--json", "doctor", "--quick"], { cwd: projectDir });
    if (!firstDev.success) {
      throw new Error(`Dev command failed: ${firstDev.stderr}`);
    }

    const events = parseNdjson(firstDev.stdout);
    const planSummary = findEvent(events, "plan:summary");
    assert(planSummary, "Missing plan:summary event");
    const summary = planSummary!.context as Record<string, unknown>;
    assert(summary.changed === false, "First cycle should be clean");
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("E2E: secrets with KV store and encryption", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo-secrets");

  try {
    // Initialize project
    const initResult = await runCli(["init", "demo-secrets", "--yes"], { cwd: workspace });
    if (!initResult.success) {
      throw new Error(`Init failed: ${initResult.stderr}`);
    }

    // Check secrets files were generated
    const secretsDir = join(projectDir, "config", "secrets");
    assert(await exists(join(secretsDir, ".env.dev")), ".env.dev missing");
    assert(await exists(join(secretsDir, ".env.staging")), ".env.staging missing");
    assert(await exists(join(secretsDir, ".env.prod")), ".env.prod missing");
    assert(await exists(join(secretsDir, ".env.example")), ".env.example missing");
    assert(await exists(join(secretsDir, "manager.ts")), "manager.ts missing");

    // Check .gitattributes was generated for git-crypt
    const gitattributesPath = join(projectDir, ".gitattributes");
    assert(await exists(gitattributesPath), ".gitattributes missing");
    const gitattributesContent = await Deno.readTextFile(gitattributesPath);
    assert(
      gitattributesContent.includes("secrets/.env.* filter=git-crypt"),
      "git-crypt config for secrets missing",
    );
    assert(
      gitattributesContent.includes(".tsera/kv/** filter=git-crypt"),
      "git-crypt config for KV missing",
    );
    assert(
      gitattributesContent.includes(".tsera/salt filter=git-crypt"),
      "git-crypt config for salt missing",
    );

    // Check .gitignore has proper patterns
    const gitignorePath = join(projectDir, ".gitignore");
    assert(await exists(gitignorePath), ".gitignore missing");
    const gitignoreContent = await Deno.readTextFile(gitignorePath);
    assert(gitignoreContent.match(/secrets\/.env\.dev/), ".gitignore should include .env.dev");
    assert(
      gitignoreContent.match(/secrets\/.env\.staging/),
      ".gitignore should include .env.staging",
    );
    assert(gitignoreContent.match(/secrets\/.env\.prod/), ".gitignore should include .env.prod");
    assert(
      gitignoreContent.match(/!secrets\/.env\.example/),
      ".gitignore should NOT ignore .env.example",
    );
    assert(gitignoreContent.match(/\.tsera\/kv\//), ".gitignore should include KV store");
    assert(gitignoreContent.match(/\.tsera\/salt/), ".gitignore should include salt");

    // Verify manager.ts has proper schema and calls initializeSecrets
    const managerPath = join(secretsDir, "manager.ts");
    const managerContent = await Deno.readTextFile(managerPath);
    assert(
      managerContent.includes("defineEnvSchema"),
      "manager.ts should use defineEnvSchema",
    );
    assert(
      managerContent.includes("DATABASE_URL"),
      "manager.ts should define DATABASE_URL",
    );
    assert(
      managerContent.includes("initializeSecrets"),
      "manager.ts should call initializeSecrets",
    );

    // Note: Detailed KV store functionality is tested in src/core/secrets/store.test.ts
    // This E2E test verifies that all files are generated correctly
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});
