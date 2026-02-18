import { assertEquals, assertStringIncludes } from "std/assert";
import { z } from "zod";
import { defineEntity } from "../../../../core/entity.ts";
import type { TseraConfig } from "../../../definitions.ts";
import { buildDrizzleArtifacts } from "../drizzle.ts";

const baseConfigPostgres: TseraConfig = {
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

const baseConfigSqlite: TseraConfig = {
  ...baseConfigPostgres,
  db: {
    dialect: "sqlite",
    file: "data.db",
  },
};

const projectDir = Deno.cwd();

Deno.test("buildDrizzleArtifacts - generates a SQL migration", async () => {
  const entity = defineEntity({
    name: "User",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      email: { validator: z.string().email(), stored: true },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres, projectDir });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "migration");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, "CREATE TABLE");
  assertStringIncludes(content, '"user"');
});

Deno.test("buildDrizzleArtifacts - filters stored: false fields", async () => {
  const entity = defineEntity({
    name: "Test",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      computed: { validator: z.string(), stored: false },
      virtual: { validator: z.number(), stored: false },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres, projectDir });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, '"id"');
  assertEquals(content.includes('"computed"'), false);
  assertEquals(content.includes('"virtual"'), false);
});

Deno.test("buildDrizzleArtifacts - does not generate migration if no stored fields", async () => {
  const entity = defineEntity({
    name: "Virtual",
    table: true,
    fields: {
      computed: { validator: z.string(), stored: false },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres, projectDir });

  assertEquals(artifacts.length, 0);
});

Deno.test("buildDrizzleArtifacts - generates deterministic filename", async () => {
  const entity = defineEntity({
    name: "Product",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
    },
  });

  const artifacts1 = await buildDrizzleArtifacts({
    entity,
    config: baseConfigPostgres,
    projectDir,
  });
  const artifacts2 = await buildDrizzleArtifacts({
    entity,
    config: baseConfigPostgres,
    projectDir,
  });

  // Same entity should generate the same filename
  assertEquals(artifacts1[0].path, artifacts2[0].path);
  const normalizedPath = artifacts1[0].path.replace(/\\/g, "/");
  assertStringIncludes(normalizedPath, "app/db/migrations/");
  assertStringIncludes(normalizedPath, "_product.sql");
});

Deno.test("buildDrizzleArtifacts - uses correct SQL dialect", async () => {
  const entity = defineEntity({
    name: "Post",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      active: { validator: z.boolean(), stored: true },
    },
  });

  const artifactsPostgres = await buildDrizzleArtifacts({
    entity,
    config: baseConfigPostgres,
    projectDir,
  });
  const artifactsSqlite = await buildDrizzleArtifacts({
    entity,
    config: baseConfigSqlite,
    projectDir,
  });

  // Both dialects should produce SQL (even if different)
  const contentPostgres = artifactsPostgres[0].content as string;
  const contentSqlite = artifactsSqlite[0].content as string;

  assertStringIncludes(contentPostgres, "CREATE TABLE");
  assertStringIncludes(contentSqlite, "CREATE TABLE");
});
