import { assertEquals, assertStringIncludes } from "../../../../testing/asserts.ts";
import { defineEntity } from "../../../../core/entity.ts";
import type { TseraConfig } from "../../../definitions.ts";
import { buildDocsArtifacts } from "../docs.ts";

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

Deno.test("buildDocsArtifacts - génère une documentation Markdown", async () => {
  const entity = defineEntity({
    name: "User",
    doc: true,
    columns: {
      id: { type: "string" },
      email: { type: "string" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "doc");
  // Normalise le chemin pour Windows
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "docs/User.md");
  assertEquals(artifacts[0].label, "User documentation");
});

Deno.test("buildDocsArtifacts - contient un tableau des propriétés", async () => {
  const entity = defineEntity({
    name: "Product",
    doc: true,
    columns: {
      name: { type: "string" },
      price: { type: "number" },
      active: { type: "boolean" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie le header
  assertStringIncludes(content, "# Product");

  // Vérifie l'en-tête du tableau
  assertStringIncludes(content, "| Property | Type | Optional | Nullable | Default |");
  assertStringIncludes(content, "| --- | --- | --- | --- | --- |");

  // Vérifie les lignes de propriétés
  assertStringIncludes(content, "| name | string | no | no | — |");
  assertStringIncludes(content, "| price | number | no | no | — |");
  assertStringIncludes(content, "| active | boolean | no | no | — |");
});

Deno.test("buildDocsArtifacts - indique les champs optionnels", async () => {
  const entity = defineEntity({
    name: "Post",
    doc: true,
    columns: {
      title: { type: "string" },
      subtitle: { type: "string", optional: true },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| title | string | no |");
  assertStringIncludes(content, "| subtitle | string | yes |");
});

Deno.test("buildDocsArtifacts - indique les champs nullables", async () => {
  const entity = defineEntity({
    name: "Comment",
    doc: true,
    columns: {
      content: { type: "string" },
      deletedAt: { type: "date", nullable: true },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| content | string | no | no |");
  assertStringIncludes(content, "| deletedAt | date | no | yes |");
});

Deno.test("buildDocsArtifacts - affiche les valeurs par défaut", async () => {
  const entity = defineEntity({
    name: "Settings",
    doc: true,
    columns: {
      theme: { type: "string", default: "dark" },
      count: { type: "number", default: 42 },
      enabled: { type: "boolean", default: true },
      nullable: { type: "string", nullable: true, default: null },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| theme | string | no | no | `dark` |");
  assertStringIncludes(content, "| count | number | no | no | 42 |");
  assertStringIncludes(content, "| enabled | boolean | no | no | true |");
  assertStringIncludes(content, "| nullable | string | no | yes | null |");
});

Deno.test("buildDocsArtifacts - formate les dates par défaut", async () => {
  const defaultDate = new Date("2024-01-01T00:00:00.000Z");
  const entity = defineEntity({
    name: "Event",
    doc: true,
    columns: {
      scheduledAt: { type: "date", default: defaultDate },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| scheduledAt | date | no | no | 2024-01-01T00:00:00.000Z |");
});

Deno.test("buildDocsArtifacts - affiche les types array", async () => {
  const entity = defineEntity({
    name: "Article",
    doc: true,
    columns: {
      tags: { type: { arrayOf: "string" } },
      scores: { type: { arrayOf: "number" } },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| tags | Array<string> |");
  assertStringIncludes(content, "| scores | Array<number> |");
});

Deno.test("buildDocsArtifacts - inclut une description automatique", async () => {
  const entity = defineEntity({
    name: "Invoice",
    doc: true,
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "Automatic documentation for Invoice.");
});

Deno.test("buildDocsArtifacts - ajoute newline final", async () => {
  const entity = defineEntity({
    name: "Profile",
    doc: true,
    columns: {
      bio: { type: "string" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertEquals(content.endsWith("\n"), true);
});

Deno.test("buildDocsArtifacts - formate les objets JSON par défaut", async () => {
  const entity = defineEntity({
    name: "Config",
    doc: true,
    columns: {
      settings: { type: "json", default: { theme: "dark", lang: "en" } },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, '`{"theme":"dark","lang":"en"}`');
});

Deno.test("buildDocsArtifacts - gère les colonnes sans valeur par défaut", async () => {
  const entity = defineEntity({
    name: "Item",
    doc: true,
    columns: {
      name: { type: "string" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "| name | string | no | no | — |");
});
