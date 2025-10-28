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
      throw new Error(`La commande init a échoué: ${initResult.stderr}`);
    }

    const openapiPath = join(projectDir, ".tsera", "openapi", "User.json");
    const schemaPath = join(projectDir, ".tsera", "schemas", "User.schema.ts");
    const docPath = join(projectDir, "docs", "User.md");

    assert(await exists(openapiPath), "Le fichier OpenAPI n'a pas été généré.");
    assert(await exists(schemaPath), "Le schéma Zod n'a pas été généré.");
    assert(await exists(docPath), "La documentation n'a pas été générée.");

    const firstDev = await runCli(["--json", "dev", "--once"], { cwd: projectDir });
    if (!firstDev.success) {
      throw new Error(`La commande dev initiale a échoué: ${firstDev.stderr}`);
    }
    assertEquals(firstDev.stderr.trim(), "", "La commande dev ne doit pas produire d'erreurs.");

    const events = parseNdjson(firstDev.stdout);
    const planSummary = findEvent(events, "plan:summary");
    assert(planSummary, "Événement plan:summary manquant.");
    const summary = planSummary!.context as Record<string, unknown>;
    assert(summary.changed === false, "Le premier cycle après init doit être propre.");

    const coherenceEvent = findEvent(events, "coherence");
    assert(coherenceEvent, "Événement coherence manquant.");
    const coherence = coherenceEvent!.context as Record<string, unknown>;
    assert(coherence.status === "clean", "Le projet doit être cohérent après init.");
    assert(coherence.pending === false, "Aucune incohérence ne doit rester après init.");

    const initialOpenapi = await Deno.readTextFile(openapiPath);

    const entityPath = join(projectDir, "domain", "User.entity.ts");
    const entitySource = await Deno.readTextFile(entityPath);
    const injection =
      '    lastLoginAt: {\n      type: "date",\n      optional: true,\n      description: "Dernière connexion.",\n    },\n\n';
    const marker = "    settings: {";
    const markerIndex = entitySource.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error("Impossible de localiser le champ settings dans l'entité User.");
    }

    const updatedSource = entitySource.replace(marker, `${injection}${marker}`);
    await Deno.writeTextFile(entityPath, updatedSource);

    const secondDev = await runCli(["--json", "dev", "--once"], { cwd: projectDir });
    if (!secondDev.success) {
      throw new Error(`La commande dev après modification a échoué: ${secondDev.stderr}`);
    }
    assertEquals(secondDev.stderr.trim(), "", "La commande dev ne doit pas produire d'erreurs.");

    const secondEvents = parseNdjson(secondDev.stdout);
    const secondSummaryEvent = findEvent(secondEvents, "plan:summary");
    assert(secondSummaryEvent, "Événement plan:summary absent après modification.");
    const secondSummary = secondSummaryEvent!.context as Record<string, unknown>;
    assert(
      (secondSummary.update as number) > 0,
      "Une mise à jour était attendue après modification de l'entité.",
    );

    const updatedOpenapi = await Deno.readTextFile(openapiPath);
    assert(
      updatedOpenapi.includes("lastLoginAt"),
      "Le fichier OpenAPI doit contenir le nouveau champ.",
    );
    assert(updatedOpenapi !== initialOpenapi, "Le fichier OpenAPI doit être régénéré.");

    console.log(`[e2e] Succès — artefacts régénérés dans ${projectDir}`);
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
