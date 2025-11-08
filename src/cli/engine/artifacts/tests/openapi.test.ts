import { assertEquals, assertStringIncludes } from "@std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import type { TseraConfig } from "../../../definitions.ts";
import { buildProjectOpenAPIArtifact } from "../openapi.ts";

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

Deno.test("buildProjectOpenAPIArtifact - génère un document OpenAPI", () => {
  const entity = defineEntity({
    name: "User",
    columns: {
      id: { type: "string" },
      email: { type: "string" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);

  assertEquals(artifact !== null, true);
  assertEquals(artifact!.kind, "openapi");
  const normalizedPath = artifact!.path.replace(/\\/g, "/");
  assertEquals(normalizedPath, ".tsera/openapi.json");
  assertEquals(artifact!.label, "Project OpenAPI");
});

Deno.test("buildProjectOpenAPIArtifact - retourne null si OpenAPI désactivé", () => {
  const entity = defineEntity({
    name: "User",
    columns: {
      id: { type: "string" },
    },
  });

  const configWithoutOpenAPI = { ...baseConfig, openapi: false };
  const artifact = buildProjectOpenAPIArtifact([entity], configWithoutOpenAPI);

  assertEquals(artifact, null);
});

Deno.test("buildProjectOpenAPIArtifact - contient les métadonnées entities", () => {
  const user = defineEntity({
    name: "User",
    columns: { id: { type: "string" } },
  });
  const post = defineEntity({
    name: "Post",
    columns: { id: { type: "string" } },
  });

  const artifact = buildProjectOpenAPIArtifact([user, post], baseConfig);

  assertEquals(artifact!.data?.entities, ["User", "Post"]);
});

Deno.test("buildProjectOpenAPIArtifact - génère du JSON valide", () => {
  const entity = defineEntity({
    name: "Product",
    columns: {
      name: { type: "string" },
      price: { type: "number" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;

  // Vérifie que c'est du JSON parsable
  const parsed = JSON.parse(content);
  assertEquals(typeof parsed, "object");
  assertEquals(parsed.openapi, "3.1.0");
});

Deno.test("buildProjectOpenAPIArtifact - trie les clés récursivement", () => {
  const entity = defineEntity({
    name: "Item",
    columns: {
      zebra: { type: "string" },
      alpha: { type: "string" },
      middle: { type: "string" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;

  // Parse le JSON et vérifie l'ordre des clés
  const parsed = JSON.parse(content);

  // Les clés de premier niveau doivent être triées
  const topLevelKeys = Object.keys(parsed);
  const sortedTopLevelKeys = [...topLevelKeys].sort();
  assertEquals(topLevelKeys, sortedTopLevelKeys);

  // Les colonnes dans le schéma doivent être triées
  if (parsed.components?.schemas?.Item?.properties) {
    const propKeys = Object.keys(parsed.components.schemas.Item.properties);
    assertEquals(propKeys, ["alpha", "middle", "zebra"]);
  }
});

Deno.test("buildProjectOpenAPIArtifact - ajoute newline final", () => {
  const entity = defineEntity({
    name: "Order",
    columns: {
      id: { type: "string" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;

  assertEquals(content.endsWith("\n"), true);
});

Deno.test("buildProjectOpenAPIArtifact - crée dépendances vers schémas", () => {
  const user = defineEntity({
    name: "User",
    columns: { id: { type: "string" } },
  });
  const post = defineEntity({
    name: "Post",
    columns: { id: { type: "string" } },
  });

  const artifact = buildProjectOpenAPIArtifact([user, post], baseConfig);

  assertEquals(artifact!.dependsOn !== undefined, true);
  assertEquals(artifact!.dependsOn!.length, 2);

  // Normalise les chemins pour Windows
  const dep0 = artifact!.dependsOn![0].replace(/\\/g, "/");
  const dep1 = artifact!.dependsOn![1].replace(/\\/g, "/");

  // Vérifie le format des dépendances
  assertStringIncludes(dep0, "schema:user:");
  assertStringIncludes(dep0, ".tsera/schemas/User.schema.ts");
  assertStringIncludes(dep1, "schema:post:");
  assertStringIncludes(dep1, ".tsera/schemas/Post.schema.ts");
});

Deno.test("buildProjectOpenAPIArtifact - JSON bien formaté avec indentation", () => {
  const entity = defineEntity({
    name: "Comment",
    columns: {
      content: { type: "string" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;

  // Vérifie l'indentation à 2 espaces
  assertStringIncludes(content, '  "openapi"');
  assertStringIncludes(content, '    "title"');
});

Deno.test("buildProjectOpenAPIArtifact - gère plusieurs entités", () => {
  const entities = [
    defineEntity({ name: "User", columns: { id: { type: "string" } } }),
    defineEntity({ name: "Post", columns: { id: { type: "string" } } }),
    defineEntity({ name: "Comment", columns: { id: { type: "string" } } }),
  ];

  const artifact = buildProjectOpenAPIArtifact(entities, baseConfig);
  const content = artifact!.content as string;
  const parsed = JSON.parse(content);

  // Vérifie que tous les schémas sont présents
  assertEquals(parsed.components?.schemas?.User !== undefined, true);
  assertEquals(parsed.components?.schemas?.Post !== undefined, true);
  assertEquals(parsed.components?.schemas?.Comment !== undefined, true);
});
