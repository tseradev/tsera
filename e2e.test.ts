import { assert } from "std/assert";
import { join } from "./src/shared/path.ts";

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
    assert(
      await exists(join(projectDir, "app", "back", "routes", "health.ts")),
      "Health route missing",
    );

    // Check Lume module

    // Check Docker module
    assert(
      await exists(join(projectDir, "config", "docker", "docker-compose.yml")),
      "docker-compose.yml missing",
    );
    assert(
      await exists(join(projectDir, "config", "docker", "Dockerfile.back")),
      "Dockerfile.back missing",
    );
    assert(
      await exists(join(projectDir, "config", "docker", "Dockerfile.front")),
      "Dockerfile.front missing",
    );

    // Check CI module
    assert(
      await exists(join(projectDir, ".github", "workflows", "ci-lint.yml")),
      "CI lint workflow missing",
    );
    assert(
      await exists(join(projectDir, ".github", "workflows", "ci-test.yml")),
      "CI test workflow missing",
    );
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
      "--no-lume",
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
    assert(
      await exists(join(projectDir, "config", "secrets", "env.config.ts")),
      "Secrets should be present",
    );

    // Check that disabled modules don't exist
    assert(!await exists(join(projectDir, "app", "front")), "Lume should be disabled");
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
    const planSummary = findEvent(events, "doctor:plan");
    assert(planSummary, "Missing doctor:plan event");
    const context = planSummary!.context as Record<string, unknown>;
    const summary = context.summary as Record<string, unknown>;
    assert(summary, "Missing summary in doctor:plan event");
    if (summary.changed !== false) {
      const summaryStr = JSON.stringify(summary, null, 2);
      throw new Error(
        `First cycle should be clean but found changes:\n${summaryStr}\n\nFull events:\n${
          JSON.stringify(events, null, 2)
        }`,
      );
    }
    assert(summary.changed === false, "First cycle should be clean");
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});

Deno.test("E2E: export-env command works", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo-export-env");

  try {
    // Initialize project
    const initResult = await runCli(["init", "demo-export-env", "--yes"], { cwd: workspace });
    if (!initResult.success) {
      throw new Error(`Init failed: ${initResult.stderr}`);
    }

    // Create a minimal environment schema in config/secrets/
    const secretDir = join(projectDir, "config", "secrets");
    const schemaContent = `
export const envSchema = {
  TEST_API_KEY: {
    type: "string",
    required: true,
  },
  TEST_PORT: {
    type: "number",
    required: false,
    default: 3000,
  },
};
`;

    await Deno.writeTextFile(join(secretDir, "env.config.ts"), schemaContent);

    // Test sh format
    const shCommand = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        CLI_ENTRY,
        "export-env",
        "--env=dev",
        "--format=sh",
        "--prefix=TEST_",
      ],
      cwd: projectDir,
      env: {
        ...Deno.env.toObject(),
        TEST_API_KEY: "test-secret-key",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code: shCode, stdout: shStdout, stderr: shStderr } = await shCommand.output();

    if (shCode !== 0) {
      throw new Error(`sh export failed: ${new TextDecoder().decode(shStderr)}`);
    }

    const shOutput = new TextDecoder().decode(shStdout);
    // sh format outputs KEY=value (dotenv format), not export KEY=value
    if (!shOutput.includes("TEST_TEST_API_KEY=test-secret-key")) {
      throw new Error(`sh output missing expected export. Got: ${shOutput}`);
    }

    // Test json format
    const jsonCommand = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        CLI_ENTRY,
        "export-env",
        "--env=dev",
        "--format=json",
        "--prefix=TEST_",
      ],
      cwd: projectDir,
      env: {
        ...Deno.env.toObject(),
        TEST_API_KEY: "test-secret-key",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code: jsonCode, stdout: jsonStdout, stderr: jsonStderr } = await jsonCommand.output();

    if (jsonCode !== 0) {
      throw new Error(`json export failed: ${new TextDecoder().decode(jsonStderr)}`);
    }

    const jsonOutput = new TextDecoder().decode(jsonStdout);
    const secrets = JSON.parse(jsonOutput) as Record<string, unknown>;

    if (secrets.TEST_TEST_API_KEY !== "test-secret-key") {
      throw new Error(`json output missing expected secret. Got: ${JSON.stringify(secrets)}`);
    }
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
});
