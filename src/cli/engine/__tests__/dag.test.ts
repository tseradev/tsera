import { assert, assertEquals } from "tsera/testing/asserts.ts";
import { defineEntity } from "tsera/core/entity.ts";
import type { TseraConfig } from "../../contracts/types.ts";
import { createDag } from "../dag.ts";
import { buildZodArtifacts } from "../artifacts/zod.ts";
import { buildOpenAPIArtifacts } from "../artifacts/openapi.ts";
import { buildDrizzleArtifacts } from "../artifacts/drizzle.ts";
import { buildDocsArtifacts } from "../artifacts/docs.ts";
import { buildTestArtifacts } from "../artifacts/tests.ts";

const baseConfig: TseraConfig = {
  projectName: "Demo",
  rootDir: ".",
  entitiesDir: "domain",
  artifactsDir: ".tsera",
  db: {
    dialect: "postgres",
    connectionString: "postgres://localhost/demo",
    migrationsDir: "drizzle",
    schemaDir: "drizzle/schema",
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

Deno.test("createDag relie les artefacts à l'entité", async () => {
  const artifacts = [
    ...(await buildZodArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildOpenAPIArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildDrizzleArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildDocsArtifacts({ entity: userEntity, config: baseConfig })),
    ...(await buildTestArtifacts({ entity: userEntity, config: baseConfig })),
  ];

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
    assert(node, `nœud absent pour ${nodeId}`);
    assertEquals(node.mode, "output");
  }

  const first = dag.order[0];
  assertEquals(first.kind, "entity");
  const edgesFromEntity = dag.edges.filter((edge) => edge.from === first.id);
  assertEquals(edgesFromEntity.length, artifacts.length);
});
