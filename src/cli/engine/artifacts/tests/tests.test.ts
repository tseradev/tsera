import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity } from "../../../../core/entity.ts";
import { z } from "zod";
import type { TseraConfig } from "../../../definitions.ts";
import { buildTestArtifacts } from "../tests.ts";

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

Deno.test("buildTestArtifacts - génère un test smoke basique", async () => {
  const entity = defineEntity({
    name: "User",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.email(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "test");
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "core/entities/User.test.ts");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, 'import { assertEquals } from "std/assert"');
  assertStringIncludes(content, "import { UserSchema");
  assertStringIncludes(content, 'Deno.test("User schema valide un exemple minimal"');
  assertStringIncludes(content, "UserSchema.parse(sample)");
});

Deno.test("buildTestArtifacts - masque les valeurs des champs visibility === secret", async () => {
  const entity = defineEntity({
    name: "User",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Les valeurs des champs secret doivent être masquées
  assertStringIncludes(content, 'password: "***"');
});

Deno.test("buildTestArtifacts - génère des tests pour public schema", async () => {
  const entity = defineEntity({
    name: "Product",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      name: { validator: z.string(), visibility: "public" },
      secret: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Doit générer un test pour le public schema
  assertStringIncludes(content, 'Deno.test("Product public schema valide un exemple minimal"');
  assertStringIncludes(content, "Product.public.parse(sample)");
});

Deno.test("buildTestArtifacts - génère des tests pour input.create", async () => {
  const entity = defineEntity({
    name: "Order",
    test: "smoke",
    fields: {
      id: { validator: z.uuid(), visibility: "public", immutable: true },
      total: { validator: z.number(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Doit générer un test pour input.create
  assertStringIncludes(content, 'Deno.test("Order input.create valide un exemple minimal"');
  assertStringIncludes(content, "Order.input.create.parse(sample)");
});

Deno.test("buildTestArtifacts - ne génère pas de test si test === false", async () => {
  const entity = defineEntity({
    name: "Hidden",
    test: false,
    fields: {
      id: { validator: z.string(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 0);
});
