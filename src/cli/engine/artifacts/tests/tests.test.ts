import { assertEquals, assertStringIncludes } from "../../../../testing/asserts.ts";
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

Deno.test("buildTestArtifacts - génère un test smoke basique", async () => {
  const entity = defineEntity({
    name: "User",
    columns: {
      id: { type: "string" },
      email: { type: "string" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "test");
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "tests/User.test.ts");

  const content = artifacts[0].content as string;
  assertStringIncludes(content, 'import { assertEquals } from "../testing/asserts.ts"');
  assertStringIncludes(content, 'import { UserSchema } from "../.tsera/schemas/User.schema.ts"');
  assertStringIncludes(content, 'Deno.test("User schema valide un exemple minimal"');
  assertStringIncludes(content, "UserSchema.parse(sample)");
});

Deno.test("buildTestArtifacts - génère des valeurs d'exemple pour tous les types", async () => {
  const entity = defineEntity({
    name: "Product",
    columns: {
      name: { type: "string" },
      price: { type: "number" },
      available: { type: "boolean" },
      createdAt: { type: "date" },
      metadata: { type: "json" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, 'name: "example"');
  assertStringIncludes(content, "price: 1");
  assertStringIncludes(content, "available: true");
  assertStringIncludes(content, 'createdAt: new Date("2020-01-01T00:00:00.000Z")');
  assertStringIncludes(content, "metadata: {}");
});

Deno.test("buildTestArtifacts - génère des arrays d'exemples", async () => {
  const entity = defineEntity({
    name: "Post",
    columns: {
      tags: { type: { arrayOf: "string" } },
      ratings: { type: { arrayOf: "number" } },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, 'tags: ["example"]');
  assertStringIncludes(content, "ratings: [1]");
});

Deno.test("buildTestArtifacts - vérifie les clés de l'objet parsé", async () => {
  const entity = defineEntity({
    name: "Article",
    columns: {
      title: { type: "string" },
      content: { type: "string" },
      views: { type: "number" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie que le test compare les clés triées
  assertStringIncludes(content, "assertEquals(Object.keys(parsed).sort()");
  assertStringIncludes(content, '"content", "title", "views"');
});

Deno.test("buildTestArtifacts - normalise les imports relatifs", async () => {
  const entity = defineEntity({
    name: "Order",
    columns: {
      id: { type: "string" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Les imports doivent commencer par ../ pour remonter depuis tests/
  assertStringIncludes(content, 'from "../testing/asserts.ts"');
  assertStringIncludes(content, 'from "../.tsera/schemas/Order.schema.ts"');
});

Deno.test("buildTestArtifacts - génère du code syntaxiquement valide", async () => {
  const entity = defineEntity({
    name: "Invoice",
    columns: {
      id: { type: "string" },
      total: { type: "number" },
      paid: { type: "boolean" },
      items: { type: { arrayOf: "json" } },
      issuedAt: { type: "date" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Vérifie la structure générale du test
  assertStringIncludes(content, "import");
  assertStringIncludes(content, "Deno.test");
  assertStringIncludes(content, "const sample = {");
  assertStringIncludes(content, "const parsed = InvoiceSchema.parse(sample)");
  assertStringIncludes(content, "assertEquals(");
});

Deno.test("buildTestArtifacts - formate correctement le code", async () => {
  const entity = defineEntity({
    name: "Comment",
    columns: {
      content: { type: "string" },
      author: { type: "string" },
    },
  });

  const artifacts = await buildTestArtifacts({ entity, config: baseConfig });
  const content = artifacts[0].content as string;

  // Le code devrait être bien formaté (pas de lignes vides excessives, indentation correcte)
  // Vérifie qu'il n'y a pas de doubles espaces dans les imports
  const lines = content.split("\n");
  const importLines = lines.filter((line) => line.startsWith("import"));
  assertEquals(importLines.length, 2); // assertEquals et Schema

  // Vérifie que l'objet sample est bien indenté
  assertStringIncludes(content, "  const sample = {");
  assertStringIncludes(content, "    content:");
  assertStringIncludes(content, "    author:");
  assertStringIncludes(content, "  }");
});

