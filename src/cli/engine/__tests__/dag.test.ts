import { assert, assertEquals, assertRejects } from "../../../testing/asserts.ts";
import { defineEntity } from "../../../core/entity.ts";
import type { TseraConfig } from "../../contracts/types.ts";
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

const userEntity = defineEntity({
  name: "User",
  table: true,
  columns: {
    id: { type: "string" },
    email: { type: "string", optional: false },
    createdAt: { type: "date", nullable: false },
    preferences: { type: "json", optional: true },
  },
  doc: true,
  test: "smoke",
});

Deno.test("createDag links artifacts to the entity", async () => {
  const artifacts = [
    ...(await buildZodArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildDrizzleArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildDocsArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildTestArtifacts({ entity: userEntity, config: baseConfig })),
  ];
  const openapiArtifact = buildProjectOpenAPIArtifact([userEntity], baseConfig);
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
