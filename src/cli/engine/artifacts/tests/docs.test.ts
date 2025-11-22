import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import { z } from "zod";
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
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "doc");
  // Normalise le chemin pour Windows
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "docs/markdown/User.md");
  assertEquals(artifacts[0].label, "User documentation");
});

Deno.test("buildDocsArtifacts - contient un tableau des propriétés publiques", async () => {
  const entity = defineEntity({
    name: "Product",
    doc: true,
    fields: {
      name: { validator: z.string(), visibility: "public" },
      price: { validator: z.number(), visibility: "public" },
      active: { validator: z.boolean(), visibility: "public" },
      secret: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie le header
  assertStringIncludes(content, "# Product");

  // Vérifie l'en-tête du tableau
  assertStringIncludes(content, "## Public Fields");
  assertStringIncludes(content, "| Property | Type | Optional | Nullable | Default | Description |");

  // Vérifie les lignes de propriétés publiques
  assertStringIncludes(content, "| name |");
  assertStringIncludes(content, "| price |");
  assertStringIncludes(content, "| active |");
  // secret ne doit pas apparaître dans Public Fields
  assertEquals(content.includes("| secret |"), false);
});

Deno.test("buildDocsArtifacts - filtre les champs visibility !== public", async () => {
  const entity = defineEntity({
    name: "Test",
    doc: true,
    fields: {
      public: { validator: z.string(), visibility: "public" },
      internal: { validator: z.string(), visibility: "internal" },
      secret: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Public Fields doit contenir uniquement "public"
  assertStringIncludes(content, "## Public Fields");
  assertStringIncludes(content, "| public |");
  assertEquals(content.includes("| internal |"), false);
  assertEquals(content.includes("| secret |"), false);

  // Internal Fields doit contenir "internal" mais pas "secret"
  assertStringIncludes(content, "## Internal Fields");
  assertStringIncludes(content, "| internal |");
  assertEquals(content.includes("| secret |"), false);
});

Deno.test("buildDocsArtifacts - utilise entity.docs.description", async () => {
  const entity = defineEntity({
    name: "Invoice",
    doc: true,
    docs: {
      description: "Custom description for Invoice entity",
    },
    fields: {
      id: { validator: z.string(), visibility: "public" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "Custom description for Invoice entity");
});

Deno.test("buildDocsArtifacts - ajoute newline final", async () => {
  const entity = defineEntity({
    name: "Profile",
    doc: true,
    fields: {
      bio: { validator: z.string(), visibility: "public" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertEquals(content.endsWith("\n"), true);
});
