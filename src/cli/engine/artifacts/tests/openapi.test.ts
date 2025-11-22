import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import { z } from "zod";
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
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);

  assertEquals(artifact !== null, true);
  assertEquals(artifact!.kind, "openapi");
  const normalizedPath = artifact!.path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "docs/openapi/OpenAPI.json");
  assertEquals(artifact!.label, "Project OpenAPI");
});

Deno.test("buildProjectOpenAPIArtifact - retourne null si OpenAPI désactivé", () => {
  const entity = defineEntity({
    name: "User",
    fields: {
      id: { validator: z.string(), visibility: "public" },
    },
  });

  const configWithoutOpenAPI = { ...baseConfig, openapi: false };
  const artifact = buildProjectOpenAPIArtifact([entity], configWithoutOpenAPI);

  assertEquals(artifact, null);
});

Deno.test("buildProjectOpenAPIArtifact - contient les métadonnées entities", () => {
  const user = defineEntity({
    name: "User",
    fields: { id: { validator: z.string(), visibility: "public" } },
  });
  const post = defineEntity({
    name: "Post",
    fields: { id: { validator: z.string(), visibility: "public" } },
  });

  const artifact = buildProjectOpenAPIArtifact([user, post], baseConfig);

  assertEquals(artifact!.data?.entities, ["User", "Post"]);
});

Deno.test("buildProjectOpenAPIArtifact - génère du JSON valide", () => {
  const entity = defineEntity({
    name: "Product",
    fields: {
      name: { validator: z.string(), visibility: "public" },
      price: { validator: z.number(), visibility: "public" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;

  // Vérifie que c'est du JSON parsable
  const parsed = JSON.parse(content);
  assertEquals(typeof parsed, "object");
  assertEquals(parsed.openapi, "3.1.0");
});

Deno.test("buildProjectOpenAPIArtifact - filtre les entités avec openapi.enabled === false", () => {
  const visible = defineEntity({
    name: "Visible",
    fields: { id: { validator: z.string(), visibility: "public" } },
    openapi: { enabled: true },
  });
  const hidden = defineEntity({
    name: "Hidden",
    fields: { id: { validator: z.string(), visibility: "public" } },
    openapi: { enabled: false },
  });

  const artifact = buildProjectOpenAPIArtifact([visible, hidden], baseConfig);
  const content = artifact!.content as string;
  const parsed = JSON.parse(content);

  assertEquals(parsed.components?.schemas?.Visible !== undefined, true);
  assertEquals(parsed.components?.schemas?.Hidden === undefined, true);
});

Deno.test("buildProjectOpenAPIArtifact - filtre les champs visibility !== public", () => {
  const entity = defineEntity({
    name: "Test",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret" },
      internal: { validator: z.string(), visibility: "internal" },
    },
  });

  const artifact = buildProjectOpenAPIArtifact([entity], baseConfig);
  const content = artifact!.content as string;
  const parsed = JSON.parse(content);

  const schema = parsed.components?.schemas?.Test;
  assertEquals(schema !== undefined, true);
  assertEquals("id" in schema.properties, true);
  assertEquals("email" in schema.properties, true);
  assertEquals("password" in schema.properties, false);
  assertEquals("internal" in schema.properties, false);
});

Deno.test("buildProjectOpenAPIArtifact - crée dépendances vers schémas", () => {
  const user = defineEntity({
    name: "User",
    fields: { id: { validator: z.string(), visibility: "public" } },
  });
  const post = defineEntity({
    name: "Post",
    fields: { id: { validator: z.string(), visibility: "public" } },
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
