import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import { z } from "zod";
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

Deno.test("buildDrizzleArtifacts - génère une migration SQL", async () => {
  const entity = defineEntity({
    name: "User",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      email: { validator: z.string().email(), stored: true },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "migration");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, "CREATE TABLE");
  assertStringIncludes(content, '"user"');
});

Deno.test("buildDrizzleArtifacts - filtre les champs stored: false", async () => {
  const entity = defineEntity({
    name: "Test",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      computed: { validator: z.string(), stored: false },
      virtual: { validator: z.number(), stored: false },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, '"id"');
  assertEquals(content.includes('"computed"'), false);
  assertEquals(content.includes('"virtual"'), false);
});

Deno.test("buildDrizzleArtifacts - ne génère pas de migration si aucun champ stored", async () => {
  const entity = defineEntity({
    name: "Virtual",
    table: true,
    fields: {
      computed: { validator: z.string(), stored: false },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  assertEquals(artifacts.length, 0);
});

Deno.test("buildDrizzleArtifacts - génère un nom de fichier déterministe", async () => {
  const entity = defineEntity({
    name: "Product",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
    },
  });

  const artifacts1 = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const artifacts2 = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  // Le même entity devrait générer le même nom de fichier
  assertEquals(artifacts1[0].path, artifacts2[0].path);
  const normalizedPath = artifacts1[0].path.replace(/\\/g, "/");
  assertStringIncludes(normalizedPath, "app/db/migrations/");
  assertStringIncludes(normalizedPath, "_product.sql");
});

Deno.test("buildDrizzleArtifacts - utilise le bon dialect SQL", async () => {
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
  });
  const artifactsSqlite = await buildDrizzleArtifacts({ entity, config: baseConfigSqlite });

  // Les deux dialectes devraient produire du SQL (même si différent)
  const contentPostgres = artifactsPostgres[0].content as string;
  const contentSqlite = artifactsSqlite[0].content as string;

  assertStringIncludes(contentPostgres, "CREATE TABLE");
  assertStringIncludes(contentSqlite, "CREATE TABLE");
});
