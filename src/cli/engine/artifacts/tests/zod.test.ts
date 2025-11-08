import { assertEquals, assertStringIncludes } from "@std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import type { TseraConfig } from "../../../definitions.ts";
import { buildZodArtifacts } from "../zod.ts";

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

Deno.test("buildZodArtifacts - génère un schéma pour types primitifs", async () => {
  const entity = defineEntity({
    name: "User",
    columns: {
      id: { type: "string" },
      age: { type: "number" },
      active: { type: "boolean" },
      createdAt: { type: "date" },
      metadata: { type: "json" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "schema");
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, ".tsera/schemas/User.schema.ts");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, 'import { z } from "zod"');
  assertStringIncludes(content, "export const UserSchema");
  assertStringIncludes(content, "id: z.string()");
  assertStringIncludes(content, "age: z.number()");
  assertStringIncludes(content, "active: z.boolean()");
  assertStringIncludes(content, "createdAt: z.date()");
  assertStringIncludes(content, "metadata: z.any()");
  assertStringIncludes(content, ".strict()");
  assertStringIncludes(content, "export type UserInput = z.infer<typeof UserSchema>");
});

Deno.test("buildZodArtifacts - gère les champs optionnels", async () => {
  const entity = defineEntity({
    name: "Post",
    columns: {
      title: { type: "string" },
      subtitle: { type: "string", optional: true },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "title: z.string()");
  assertStringIncludes(content, "subtitle: z.string().optional()");
});

Deno.test("buildZodArtifacts - gère les champs nullables", async () => {
  const entity = defineEntity({
    name: "Comment",
    columns: {
      content: { type: "string" },
      deletedAt: { type: "date", nullable: true },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "content: z.string()");
  assertStringIncludes(content, "deletedAt: z.date().nullable()");
});

Deno.test("buildZodArtifacts - gère les valeurs par défaut", async () => {
  const entity = defineEntity({
    name: "Settings",
    columns: {
      theme: { type: "string", default: "dark" },
      count: { type: "number", default: 42 },
      enabled: { type: "boolean", default: true },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, 'theme: z.string().default("dark")');
  assertStringIncludes(content, "count: z.number().default(42)");
  assertStringIncludes(content, "enabled: z.boolean().default(true)");
});

Deno.test("buildZodArtifacts - gère les descriptions", async () => {
  const entity = defineEntity({
    name: "Product",
    columns: {
      name: { type: "string", description: "Product name" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, 'name: z.string().describe("Product name")');
});

Deno.test("buildZodArtifacts - gère les arrays", async () => {
  const entity = defineEntity({
    name: "Article",
    columns: {
      tags: { type: { arrayOf: "string" } },
      scores: { type: { arrayOf: "number" } },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "tags: z.array(z.string())");
  assertStringIncludes(content, "scores: z.array(z.number())");
});

Deno.test("buildZodArtifacts - combine optional et nullable", async () => {
  const entity = defineEntity({
    name: "Profile",
    columns: {
      bio: { type: "string", optional: true, nullable: true },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "bio: z.string().nullable().optional()");
});

Deno.test("buildZodArtifacts - gère les dates par défaut", async () => {
  const defaultDate = new Date("2024-01-01T00:00:00.000Z");
  const entity = defineEntity({
    name: "Event",
    columns: {
      scheduledAt: { type: "date", default: defaultDate },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(
    content,
    'scheduledAt: z.date().default(new Date("2024-01-01T00:00:00.000Z"))',
  );
});

Deno.test("buildZodArtifacts - gère null comme valeur par défaut", async () => {
  const entity = defineEntity({
    name: "Item",
    columns: {
      optional: { type: "string", nullable: true, default: null },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "optional: z.string().nullable().default(null)");
});

Deno.test("buildZodArtifacts - génère du code syntaxiquement valide", async () => {
  const entity = defineEntity({
    name: "Complex",
    columns: {
      id: { type: "string" },
      count: { type: "number", optional: true, default: 0 },
      tags: { type: { arrayOf: "string" }, optional: true },
      data: { type: "json", nullable: true, description: "Arbitrary JSON data" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie que le code est bien formaté et contient les éléments clés
  assertStringIncludes(content, 'import { z } from "zod"');
  assertStringIncludes(content, "export const ComplexSchema = z.object({");
  assertStringIncludes(content, "}).strict()");
  assertStringIncludes(content, "export type ComplexInput = z.infer<typeof ComplexSchema>");
});
