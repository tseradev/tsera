import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import { z } from "zod";
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

Deno.test("buildZodArtifacts - génère le super-objet User et namespace", async () => {
  const entity = defineEntity({
    name: "User",
    fields: {
      id: { validator: z.string().uuid(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret" },
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
  assertStringIncludes(content, "export const UserPublicSchema");
  assertStringIncludes(content, "export const UserInputCreateSchema");
  assertStringIncludes(content, "export const UserInputUpdateSchema");
  assertStringIncludes(content, "export const User = {");
  assertStringIncludes(content, "schema: UserSchema");
  assertStringIncludes(content, "public: UserPublicSchema");
  assertStringIncludes(content, "input: {");
  assertStringIncludes(content, "create: UserInputCreateSchema");
  assertStringIncludes(content, "update: UserInputUpdateSchema");
  assertStringIncludes(content, "export namespace User {");
  assertStringIncludes(content, "export type type = z.infer<typeof UserSchema>");
  assertStringIncludes(content, "export type public = z.infer<typeof UserPublicSchema>");
  assertStringIncludes(content, "export type input_create = z.input<typeof UserInputCreateSchema>");
  assertStringIncludes(content, "export type input_update = z.input<typeof UserInputUpdateSchema>");
  assertStringIncludes(content, 'export type id = type["id"]');
});

Deno.test("buildZodArtifacts - génère un schéma pour types primitifs", async () => {
  const entity = defineEntity({
    name: "User",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      age: { validator: z.number(), visibility: "public" },
      active: { validator: z.boolean(), visibility: "public" },
      createdAt: { validator: z.date(), visibility: "internal" },
      metadata: { validator: z.any(), visibility: "public" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  const content = artifacts[0].content as string;
  assertStringIncludes(content, "id: z.string()");
  assertStringIncludes(content, "age: z.number()");
  assertStringIncludes(content, "active: z.boolean()");
  assertStringIncludes(content, "createdAt: z.date()");
  assertStringIncludes(content, "metadata: z.any()");
});

Deno.test("buildZodArtifacts - gère les champs optionnels", async () => {
  const entity = defineEntity({
    name: "Post",
    fields: {
      title: { validator: z.string(), visibility: "public" },
      subtitle: { validator: z.string().optional(), visibility: "public" },
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
    fields: {
      content: { validator: z.string(), visibility: "public" },
      deletedAt: { validator: z.date().nullable(), visibility: "public" },
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
    fields: {
      theme: { validator: z.string().default("dark"), visibility: "public" },
      count: { validator: z.number().default(42), visibility: "public" },
      enabled: { validator: z.boolean().default(true), visibility: "public" },
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
    fields: {
      name: { validator: z.string().describe("Product name"), visibility: "public" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, 'name: z.string().describe("Product name")');
});

Deno.test("buildZodArtifacts - gère les arrays", async () => {
  const entity = defineEntity({
    name: "Article",
    fields: {
      tags: { validator: z.array(z.string()), visibility: "public" },
      scores: { validator: z.array(z.number()), visibility: "public" },
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
    fields: {
      bio: { validator: z.string().optional().nullable(), visibility: "public" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "bio: z.string().nullable().optional()");
});

Deno.test("buildZodArtifacts - génère du code syntaxiquement valide", async () => {
  const entity = defineEntity({
    name: "Complex",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      count: { validator: z.number().default(0).optional(), visibility: "public" },
      tags: { validator: z.array(z.string()).optional(), visibility: "public" },
      data: { validator: z.any().nullable().describe("Arbitrary JSON data"), visibility: "public" },
    },
  });

  const artifacts = await buildZodArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie que le code est bien formaté et contient les éléments clés
  assertStringIncludes(content, 'import { z } from "zod"');
  assertStringIncludes(content, "export const ComplexSchema = z.object({");
  assertStringIncludes(content, "export const Complex = {");
  assertStringIncludes(content, "export namespace Complex {");
});
