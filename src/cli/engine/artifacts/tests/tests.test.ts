import { assertEquals, assertStringIncludes } from "std/assert";
import { z } from "zod";
import { defineEntity } from "../../../../core/entity.ts";
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

const projectDir = Deno.cwd();

Deno.test("buildTestArtifacts - generates a basic smoke test", async () => {
  const entity = defineEntity({
    name: "User",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig, projectDir });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "test");
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "core/entities/User.test.ts");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, 'import { assertEquals } from "std/assert"');
  assertStringIncludes(content, "import { UserSchema");
  assertStringIncludes(content, 'Deno.test("User schema validates a minimal example"');
  assertStringIncludes(content, "UserSchema.parse(sample)");
});

Deno.test("buildTestArtifacts - masks values of visibility === secret fields", async () => {
  const entity = defineEntity({
    name: "User",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  // Secret field values must be masked
  assertStringIncludes(content, 'password: "***"');
});

Deno.test("buildTestArtifacts - generates tests for public schema", async () => {
  const entity = defineEntity({
    name: "Product",
    test: "smoke",
    fields: {
      id: { validator: z.string(), visibility: "public" },
      name: { validator: z.string(), visibility: "public" },
      secret: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  // Should generate a test for the public schema
  assertStringIncludes(content, 'Deno.test("Product public schema validates a minimal example"');
  assertStringIncludes(content, "Product.public.parse(sample)");
});

Deno.test("buildTestArtifacts - generates tests for input.create", async () => {
  const entity = defineEntity({
    name: "Order",
    test: "smoke",
    fields: {
      id: { validator: z.uuid(), visibility: "public", immutable: true },
      total: { validator: z.number(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  // Should generate a test for input.create
  assertStringIncludes(content, 'Deno.test("Order input.create validates a minimal example"');
  assertStringIncludes(content, "Order.input.create.parse(sample)");
});

Deno.test("buildTestArtifacts - does not generate test if test === false", async () => {
  const entity = defineEntity({
    name: "Hidden",
    test: false,
    fields: {
      id: { validator: z.string(), visibility: "public" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig, projectDir });

  assertEquals(artifacts.length, 0);
});
