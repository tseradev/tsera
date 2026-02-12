import { assert, assertEquals, assertRejects } from "std/assert";
import { defineEntity } from "../../../core/entity.ts";
import { z } from "zod";
import type { TseraConfig } from "../../definitions.ts";
import { createDag } from "../dag.ts";
import { buildZodArtifacts } from "../artifacts/zod.ts";
import { buildProjectOpenAPIArtifact } from "../artifacts/openapi.ts";
import { buildDrizzleArtifacts } from "../artifacts/drizzle.ts";
import { buildDocsArtifacts } from "../artifacts/docs.ts";
import { buildTestArtifacts } from "../artifacts/tests.ts";

const baseConfig: TseraConfig = {
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

const userEntity = defineEntity({
  name: "User",
  table: true,
  fields: {
    id: { validator: z.string(), visibility: "public" },
    email: { validator: z.string().email(), visibility: "public" },
    createdAt: { validator: z.date(), visibility: "internal" },
    preferences: { validator: z.any().optional(), visibility: "public" },
  },
  doc: true,
  test: "smoke",
});

Deno.test("createDag links artifacts to the entity", async () => {
  const artifacts = [
    ...(await buildZodArtifacts({ entity: userEntity, config: baseConfig, projectDir })),
    ...(await buildDrizzleArtifacts({ entity: userEntity, config: baseConfig, projectDir })),
    ...(await buildDocsArtifacts({ entity: userEntity, config: baseConfig, projectDir })),
    ...(await buildTestArtifacts({ entity: userEntity, config: baseConfig, projectDir })),
  ];
  const openapiArtifact = await buildProjectOpenAPIArtifact([userEntity], baseConfig, projectDir);
  if (openapiArtifact) {
    artifacts.push(openapiArtifact);
  }

  const dag = await createDag([
    {
      entity: userEntity,
      sourcePath: "domain/User.entity.ts",
      artifacts,
    },
  ], { cliVersion: "0.1.0" });

  assertEquals(dag.nodes.size, 1 + artifacts.length);
  const entityNode = dag.nodes.get("entity:User");
  assert(entityNode);
  assertEquals(entityNode.kind, "entity");
  assertEquals(entityNode.mode, "input");

  for (const artifact of artifacts) {
    const nodeId = `${artifact.kind}:user:${artifact.path}`;
    const node = dag.nodes.get(nodeId);
    assert(node, `missing node for ${nodeId}`);
    assertEquals(node.mode, "output");
  }

  const first = dag.order[0];
  assertEquals(first.kind, "entity");
  const edgesFromEntity = dag.edges.filter((edge) => edge.from === first.id);
  assertEquals(edgesFromEntity.length, artifacts.length);
});

Deno.test("createDag reports unknown dependencies", async () => {
  const dagPromise = createDag([
    {
      entity: userEntity,
      sourcePath: "domain/User.entity.ts",
      artifacts: [
        {
          kind: "schema",
          path: ".tsera/schemas/User.schema.ts",
          content: "export const schema = {};",
          dependsOn: ["schema:user:missing"],
        },
      ],
    },
  ], { cliVersion: "0.1.0" });

  await assertRejects(
    () => dagPromise,
    "An edge references an unknown node in the graph",
  );
});
