import { assertEquals, assertStringIncludes } from "../../../../testing/asserts.ts";
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

Deno.test("buildDrizzleArtifacts - génère une migration SQL", async () => {
  const entity = defineEntity({
    name: "User",
    table: true,
    columns: {
      id: { type: "string" },
      email: { type: "string" },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "migration");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, "CREATE TABLE");
  assertStringIncludes(content, '"user"');
});

Deno.test("buildDrizzleArtifacts - génère un nom de fichier déterministe", async () => {
  const entity = defineEntity({
    name: "Product",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts1 = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const artifacts2 = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  // Le même entity devrait générer le même nom de fichier
  assertEquals(artifacts1[0].path, artifacts2[0].path);
  const normalizedPath = artifacts1[0].path.replace(/\\/g, "/");
  assertStringIncludes(normalizedPath, "drizzle/");
  assertStringIncludes(normalizedPath, "_product.sql");
});

Deno.test("buildDrizzleArtifacts - nom de fichier change si DDL change", async () => {
  const entity1 = defineEntity({
    name: "Order",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const entity2 = defineEntity({
    name: "Order",
    table: true,
    columns: {
      id: { type: "string" },
      total: { type: "number" },
    },
  });

  const artifacts1 = await buildDrizzleArtifacts({ entity: entity1, config: baseConfigPostgres });
  const artifacts2 = await buildDrizzleArtifacts({ entity: entity2, config: baseConfigPostgres });

  // Des DDL différents devraient générer des noms de fichiers différents
  assertEquals(artifacts1[0].path !== artifacts2[0].path, true);
});

Deno.test("buildDrizzleArtifacts - format de timestamp déterministe", async () => {
  const entity = defineEntity({
    name: "Invoice",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  const filename = normalizedPath.split("/")[1];

  // Format attendu: YYYYMMDDHHMM_microseconds_entity.sql
  const regex = /^\d{12}_\d{6}_invoice\.sql$/;
  assertEquals(regex.test(filename), true);
});

Deno.test("buildDrizzleArtifacts - ajoute un newline final", async () => {
  const entity = defineEntity({
    name: "Comment",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const content = artifacts[0].content as string;

  // Vérifie que le contenu se termine par un newline
  assertEquals(content.endsWith("\n"), true);
});

Deno.test("buildDrizzleArtifacts - utilise le bon dialect SQL", async () => {
  const entity = defineEntity({
    name: "Post",
    table: true,
    columns: {
      id: { type: "string" },
      active: { type: "boolean" },
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

Deno.test("buildDrizzleArtifacts - inclut les métadonnées entity", async () => {
  const entity = defineEntity({
    name: "Article",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });

  assertEquals(artifacts[0].data?.entity, "Article");
  assertEquals(artifacts[0].label, "Article migration");
});

Deno.test("buildDrizzleArtifacts - chemin dans le dossier drizzle", async () => {
  const entity = defineEntity({
    name: "Settings",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildDrizzleArtifacts({ entity, config: baseConfigPostgres });
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");

  assertStringIncludes(normalizedPath, "drizzle/");
});

