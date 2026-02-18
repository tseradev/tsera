import { assertEquals } from "std/assert";
import { z } from "zod";
import { defineEntity } from "../../../core/entity.ts";
import { join } from "../../../shared/path.ts";
import type { TseraConfig } from "../../definitions.ts";
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

async function createTestImportMap(projectDir: string): Promise<void> {
  const srcPath = join(Deno.cwd(), "src");
  // Normalize path for Windows
  const normalizedSrcPath = srcPath.replace(/\\/g, "/");
  const importMap = {
    imports: {
      "tsera/": `file://${normalizedSrcPath}/`,
      "tsera/core/": `file://${normalizedSrcPath}/core/`,
      "tsera/cli/": `file://${normalizedSrcPath}/cli/`,
    },
  };
  await Deno.writeTextFile(
    join(projectDir, "import_map.json"),
    JSON.stringify(importMap, null, 2),
  );
  // Create deno.jsonc to reference the import map
  const denoConfig = {
    "importMap": "./import_map.json",
  };
  await Deno.writeTextFile(
    join(projectDir, "deno.jsonc"),
    JSON.stringify(denoConfig, null, 2),
  );
}

Deno.test("discoverEntities loads the paths defined in configuration", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    await createTestImportMap(tempDir);
    const entityDir = join(tempDir, "domain");
    await Deno.mkdir(entityDir, { recursive: true });
    const entityPath = join(entityDir, "Example.entity.ts");
    await Deno.writeTextFile(
      entityPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        'import { z } from "zod";',
        "export default defineEntity({",
        '  name: "Example",',
        "  fields: { id: { validator: z.string() } },",
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
    await createTestImportMap(tempDir);
    const firstPath = join(tempDir, "domain", "User.entity.ts");
    const secondPath = join(tempDir, "domain", "nested", "Order.entity.ts");
    await Deno.mkdir(join(tempDir, "domain", "nested"), { recursive: true });

    await Deno.writeTextFile(
      firstPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        'import { z } from "zod";',
        "export default defineEntity({",
        '  name: "User",',
        "  fields: { id: { validator: z.string() } },",
        "});",
      ].join("\n"),
    );

    await Deno.writeTextFile(
      secondPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        'import { z } from "zod";',
        "export default defineEntity({",
        '  name: "Order",',
        "  fields: { id: { validator: z.string() } },",
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
    fields: {
      id: { validator: z.string() },
      total: { validator: z.number() },
    },
  });

  const artifacts = await buildEntityArtifacts(entity, baseConfig, Deno.cwd());
  assertEquals(artifacts.map((artifact) => artifact.kind), [
    "schema",
    "migration",
    "drizzle-schema",
    "doc",
    "test",
  ]);

  const schemaId = `schema:invoice:${artifacts[0].path}`;
  const migrationId = `migration:invoice:${artifacts[1].path}`;
  const drizzleSchemaId = `drizzle-schema:invoice:${artifacts[2].path}`;
  const docId = `doc:invoice:${artifacts[3].path}`;

  // Each stage depends on the previous stage
  assertEquals(artifacts[1].dependsOn, [schemaId]);
  assertEquals(artifacts[2].dependsOn, [migrationId]);
  assertEquals(artifacts[3].dependsOn, [drizzleSchemaId]);
  assertEquals(artifacts[4].dependsOn, [docId]);
});

Deno.test("buildEntityArtifacts omits optional artifacts", async () => {
  const entity = defineEntity({
    name: "Profile",
    table: false,
    doc: false,
    test: false,
    fields: {
      id: { validator: z.string() },
    },
  });

  const artifacts = await buildEntityArtifacts(entity, baseConfig, Deno.cwd());
  assertEquals(artifacts.map((artifact) => artifact.kind), [
    "schema",
  ]);
});

Deno.test("prepareDagInputs adds an aggregated OpenAPI artifact", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    await createTestImportMap(tempDir);
    const entityPath = join(tempDir, "domain", "User.entity.ts");
    await Deno.mkdir(join(tempDir, "domain"), { recursive: true });
    await Deno.writeTextFile(
      entityPath,
      [
        'import { defineEntity } from "tsera/core/entity.ts";',
        'import { z } from "zod";',
        "export default defineEntity({",
        '  name: "User",',
        '  fields: { id: { validator: z.string(), visibility: "public" } },',
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
