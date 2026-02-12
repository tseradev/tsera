import { assertEquals } from "std/assert";
import { defineEntity } from "../../../core/entity.ts";
import type { TseraConfig } from "../../definitions.ts";
import { buildDocsArtifacts } from "../artifacts/docs.ts";
import { buildDrizzleArtifacts } from "../artifacts/drizzle.ts";
import { buildProjectOpenAPIArtifact } from "../artifacts/openapi.ts";
import { buildTestArtifacts } from "../artifacts/tests.ts";
import { buildZodArtifacts } from "../artifacts/zod.ts";
import { createDag } from "../dag.ts";
import { planDag, type PlanStep } from "../planner.ts";
import { applySnapshots, createEmptyState } from "../state.ts";
import { z } from "zod";

const config: TseraConfig = {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["domain"] },
  db: {
    dialect: "postgres",
    urlEnv: "DATABASE_URL",
    ssl: "prefer",
  },
  deploy: {
    target: "deno_deploy",
    entry: "main.ts",
  },
};

const projectDir = Deno.cwd();

const entityV1 = defineEntity({
  name: "Invoice",
  table: true,
  fields: {
    id: { validator: z.string() },
    total: { validator: z.number() },
  },
  doc: true,
  test: "smoke",
});

const entityV2 = defineEntity({
  name: "Invoice",
  table: true,
  fields: {
    id: { validator: z.string() },
    total: { validator: z.number() },
    currency: { validator: z.string().default("EUR") },
  },
  doc: true,
  test: "smoke",
});

Deno.test("planDag computes create/update/delete summaries", async () => {
  const artifactsV1 = [
    ...(await buildZodArtifacts({ entity: entityV1, config, projectDir })),
    ...(await buildDrizzleArtifacts({ entity: entityV1, config, projectDir })),
    ...(await buildDocsArtifacts({ entity: entityV1, config, projectDir })),
    ...(await buildTestArtifacts({ entity: entityV1, config, projectDir })),
  ];
  const openapiV1 = await buildProjectOpenAPIArtifact([entityV1], config, projectDir);
  if (openapiV1) {
    artifactsV1.push(openapiV1);
  }

  const dagV1 = await createDag([
    { entity: entityV1, sourcePath: "domain/Invoice.entity.ts", artifacts: artifactsV1 },
  ], { cliVersion: "0.1.0" });

  let state = createEmptyState();
  const planCreate = planDag(dagV1, state);
  assertEquals(planCreate.summary.create, artifactsV1.length);
  assertEquals(planCreate.summary.changed, true);

  state = applySnapshots(state, toUpdates(planCreate.steps));

  const artifactsV2 = [
    ...(await buildZodArtifacts({ entity: entityV2, config, projectDir })),
    ...(await buildDrizzleArtifacts({ entity: entityV2, config, projectDir })),
    ...(await buildDocsArtifacts({ entity: entityV2, config, projectDir })),
    ...(await buildTestArtifacts({ entity: entityV2, config, projectDir })),
  ];
  const openapiV2 = await buildProjectOpenAPIArtifact([entityV2], config, projectDir);
  if (openapiV2) {
    artifactsV2.push(openapiV2);
  }

  const dagV2 = await createDag([
    { entity: entityV2, sourcePath: "domain/Invoice.entity.ts", artifacts: artifactsV2 },
  ], { cliVersion: "0.1.0" });

  const planUpdate = planDag(dagV2, state);
  assertEquals(planUpdate.summary.update > 0, true);
  state = applySnapshots(state, toUpdates(planUpdate.steps));

  const artifactsV3 = [
    ...(await buildZodArtifacts({ entity: entityV2, config, projectDir })),
    ...(await buildDrizzleArtifacts({ entity: entityV2, config, projectDir })),
  ];
  const openapiV3 = await buildProjectOpenAPIArtifact([entityV2], config, projectDir);
  if (openapiV3) {
    artifactsV3.push(openapiV3);
  }
  const dagV3 = await createDag([
    { entity: entityV2, sourcePath: "domain/Invoice.entity.ts", artifacts: artifactsV3 },
  ], { cliVersion: "0.1.0" });

  const planDelete = planDag(dagV3, state);
  assertEquals(planDelete.summary.delete > 0, true);
});

function toUpdates(
  steps: PlanStep[],
): { node: PlanStep["node"]; action: "create" | "update" | "delete" }[] {
  const updates: { node: PlanStep["node"]; action: "create" | "update" | "delete" }[] = [];
  for (const step of steps) {
    if (step.kind === "noop") {
      continue;
    }
    updates.push({ node: step.node, action: step.kind });
  }
  return updates;
}
