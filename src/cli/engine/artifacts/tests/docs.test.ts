import { assertEquals, assertStringIncludes } from "std/assert";
import { z } from "zod";
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

const projectDir = Deno.cwd();

Deno.test("buildDocsArtifacts - generates Markdown documentation", async () => {
  const entity = defineEntity({
    name: "User",
    doc: true,
    fields: {
      id: { validator: z.string(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig, projectDir });

  assertEquals(artifacts.length, 1);
  assertEquals(artifacts[0].kind, "doc");
  // Normalize path for Windows
  const normalizedPath = artifacts[0].path.replace(/\\/g, "/");
  assertEquals(normalizedPath, "docs/markdown/User.md");
  assertEquals(artifacts[0].label, "User documentation");
});

Deno.test("buildDocsArtifacts - contains a table of public properties", async () => {
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

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  // Verify header
  assertStringIncludes(content, "# Product");

  // Verify table header
  assertStringIncludes(content, "## Public Fields");
  assertStringIncludes(
    content,
    "| Property | Type | Optional | Nullable | Default | Description |",
  );

  // Verify public property rows
  assertStringIncludes(content, "| name |");
  assertStringIncludes(content, "| price |");
  assertStringIncludes(content, "| active |");
  // secret should not appear in Public Fields
  assertEquals(content.includes("| secret |"), false);
});

Deno.test("buildDocsArtifacts - filters fields with visibility !== public", async () => {
  const entity = defineEntity({
    name: "Test",
    doc: true,
    fields: {
      public: { validator: z.string(), visibility: "public" },
      internal: { validator: z.string(), visibility: "internal" },
      secret: { validator: z.string(), visibility: "secret" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  // Public Fields should only contain "public"
  assertStringIncludes(content, "## Public Fields");
  assertStringIncludes(content, "| public |");

  // Internal Fields should contain "internal" but not "secret"
  assertStringIncludes(content, "## Internal Fields");
  assertStringIncludes(content, "| internal |");

  // secret should never appear in the documentation
  assertEquals(content.includes("| secret |"), false);
});

Deno.test("buildDocsArtifacts - uses entity.docs.description", async () => {
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

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  assertStringIncludes(content, "Custom description for Invoice entity");
});

Deno.test("buildDocsArtifacts - adds trailing newline", async () => {
  const entity = defineEntity({
    name: "Profile",
    doc: true,
    fields: {
      bio: { validator: z.string(), visibility: "public" },
    },
  });

  const artifacts = await buildDocsArtifacts({ entity, config: baseConfig, projectDir });
  const content = artifacts[0].content as string;

  assertEquals(content.endsWith("\n"), true);
});
