import { join } from "../../../shared/path.ts";
import { assertEquals } from "../../../testing/asserts.ts";
import { defineEntity } from "../../../core/entity.ts";
import type { TseraConfig } from "../../contracts/types.ts";
import { buildEntityArtifacts, discoverEntities, prepareDagInputs } from "../entities.ts";

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

Deno.test("discoverEntities loads the paths defined in configuration", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const entityDir = join(tempDir, "domain");
    await Deno.mkdir(entityDir, { recursive: true });
    const entityPath = join(entityDir, "Example.entity.ts");
    await Deno.writeTextFile(
      entityPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        "export default defineEntity({",
        '  name: "Example",',
        '  columns: { id: { type: "string" } },',
        "});",
      ].join("\n"),
    );

    const config: TseraConfig = {
      ...baseConfig,
      paths: { entities: ["domain/Example.entity.ts"] },
    };
    const discovered = await discoverEntities(tempDir, config);

    assertEquals(discovered.length, 1);
    assertEquals(discovered[0].sourcePath, "domain/Example.entity.ts");
    assertEquals(discovered[0].entity.name, "Example");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("discoverEntities detects convention-based entities", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const firstPath = join(tempDir, "domain", "User.entity.ts");
    const secondPath = join(tempDir, "domain", "nested", "Order.entity.ts");
    await Deno.mkdir(join(tempDir, "domain", "nested"), { recursive: true });

    await Deno.writeTextFile(
      firstPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        "export default defineEntity({",
        '  name: "User",',
        '  columns: { id: { type: "string" } },',
        "});",
      ].join("\n"),
    );

    await Deno.writeTextFile(
      secondPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        "export default defineEntity({",
        '  name: "Order",',
        '  columns: { id: { type: "string" } },',
        "});",
      ].join("\n"),
    );

    const discovered = await discoverEntities(tempDir, baseConfig);
    assertEquals(discovered.map((item) => item.sourcePath), [
      "domain/User.entity.ts",
      "domain/nested/Order.entity.ts",
    ]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("buildEntityArtifacts respects the dependency chain", async () => {
  const entity = defineEntity({
    name: "Invoice",
    table: true,
    doc: true,
    test: "smoke",
    columns: {
      id: { type: "string" },
      total: { type: "number" },
    },
  });

  const artifacts = await buildEntityArtifacts(entity, baseConfig);
  assertEquals(artifacts.map((artifact) => artifact.kind), [
    "schema",
    "migration",
    "doc",
    "test",
  ]);

  const schemaId = `schema:invoice:${artifacts[0].path}`;
  const migrationId = `migration:invoice:${artifacts[1].path}`;
  const docId = `doc:invoice:${artifacts[2].path}`;

  assertEquals(artifacts[1].dependsOn, [schemaId]);
  assertEquals(artifacts[2].dependsOn, [migrationId]);
  assertEquals(artifacts[3].dependsOn, [docId]);
});

Deno.test("buildEntityArtifacts omits optional artifacts", async () => {
  const entity = defineEntity({
    name: "Profile",
    table: false,
    doc: false,
    test: false,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildEntityArtifacts(entity, baseConfig);
  assertEquals(artifacts.map((artifact) => artifact.kind), [
    "schema",
  ]);
});

Deno.test("prepareDagInputs adds an aggregated OpenAPI artifact", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const entityPath = join(tempDir, "domain", "User.entity.ts");
    await Deno.mkdir(join(tempDir, "domain"), { recursive: true });
    await Deno.writeTextFile(
      entityPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        "export default defineEntity({",
        '  name: "User",',
        '  columns: { id: { type: "string" } },',
        "  doc: true,",
        "});",
      ].join("\n"),
    );

    const inputs = await prepareDagInputs(tempDir, baseConfig);
    assertEquals(inputs.length, 1);
    const kinds = inputs[0].artifacts.map((artifact) => artifact.kind);
    assertEquals(kinds.includes("openapi"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
