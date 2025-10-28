#!/usr/bin/env -S deno run -A
import { join } from "../src/shared/path.ts";
import { assert, assertEquals } from "../src/testing/asserts.ts";

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

async function main(): Promise<void> {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo");

  try {
    const initResult = await runCli(["init", "demo"], { cwd: workspace });
    if (!initResult.success) {
      throw new Error(`The init command failed: ${initResult.stderr}`);
    }

    const openapiPath = join(projectDir, ".tsera", "openapi", "User.json");
    const schemaPath = join(projectDir, ".tsera", "schemas", "User.schema.ts");
    const docPath = join(projectDir, "docs", "User.md");

    assert(await exists(openapiPath), "The OpenAPI file was not generated.");
    assert(await exists(schemaPath), "The Zod schema was not generated.");
    assert(await exists(docPath), "The documentation file was not generated.");

    const firstDev = await runCli(["--json", "dev", "--once"], { cwd: projectDir });
    if (!firstDev.success) {
      throw new Error(`The initial dev command failed: ${firstDev.stderr}`);
    }
    assertEquals(firstDev.stderr.trim(), "", "The dev command should not output errors.");

    const events = parseNdjson(firstDev.stdout);
    const planSummary = findEvent(events, "plan:summary");
    assert(planSummary, "Missing plan:summary event.");
    const summary = planSummary!.context as Record<string, unknown>;
    assert(summary.changed === false, "The first cycle after init must be clean.");

    const coherenceEvent = findEvent(events, "coherence");
    assert(coherenceEvent, "Missing coherence event.");
    const coherence = coherenceEvent!.context as Record<string, unknown>;
    assert(coherence.status === "clean", "The project should be coherent after init.");
    assert(coherence.pending === false, "No inconsistencies should remain after init.");

    const initialOpenapi = await Deno.readTextFile(openapiPath);

    const entityPath = join(projectDir, "domain", "User.entity.ts");
    const entitySource = await Deno.readTextFile(entityPath);
    const injection =
      '    lastLoginAt: {\n      type: "date",\n      optional: true,\n      description: "Last login.",\n    },\n\n';
    const marker = "    settings: {";
    const markerIndex = entitySource.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error("Unable to locate the settings field in the User entity.");
    }

    const updatedSource = entitySource.replace(marker, `${injection}${marker}`);
    await Deno.writeTextFile(entityPath, updatedSource);

    const secondDev = await runCli(["--json", "dev", "--once"], { cwd: projectDir });
    if (!secondDev.success) {
      throw new Error(`The dev command after modification failed: ${secondDev.stderr}`);
    }
    assertEquals(secondDev.stderr.trim(), "", "The dev command should not output errors.");

    const secondEvents = parseNdjson(secondDev.stdout);
    const secondSummaryEvent = findEvent(secondEvents, "plan:summary");
    assert(secondSummaryEvent, "Missing plan:summary event after modification.");
    const secondSummary = secondSummaryEvent!.context as Record<string, unknown>;
    assert(
      (secondSummary.update as number) > 0,
      "An update was expected after modifying the entity.",
    );

    const updatedOpenapi = await Deno.readTextFile(openapiPath);
    assert(
      updatedOpenapi.includes("lastLoginAt"),
      "The OpenAPI file must contain the new field.",
    );
    assert(updatedOpenapi !== initialOpenapi, "The OpenAPI file must be regenerated.");

    console.log(`[e2e] Success — artifacts regenerated in ${projectDir}`);
  } finally {
    await Deno.remove(workspace, { recursive: true });
  }
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

if (import.meta.main) {
  await main();
}
