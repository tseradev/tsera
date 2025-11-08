import { assertEquals, assertExists, assertRejects } from "../test-utils/asserts.ts";
import { defineEnvSchema, initializeSecrets } from "tsera/core/secrets.ts";

Deno.test("initializeSecrets - loads variables from .env file", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  const envContent = `
PORT=3000
DATABASE_URL=postgresql://localhost:5432/test
DEBUG=true
`;
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, envContent);

  const schema = defineEnvSchema({
    PORT: {
      type: "number",
      required: true,
    },
    DATABASE_URL: {
      type: "string",
      required: true,
    },
    DEBUG: {
      type: "boolean",
      required: false,
      default: false,
    },
  });

  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
  });

  assertExists(globalThis.tsera);
  assertEquals(globalThis.tsera.currentEnvironment, "dev");
  assertEquals(globalThis.tsera.env("PORT"), 3000);
  assertEquals(globalThis.tsera.env("DATABASE_URL"), "postgresql://localhost:5432/test");
  assertEquals(globalThis.tsera.env("DEBUG"), true);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - uses default values", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Empty .env file
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "");

  const schema = defineEnvSchema({
    PORT: {
      type: "number",
      required: false,
      default: 8000,
    },
    DEBUG: {
      type: "boolean",
      required: false,
      default: false,
    },
  });

  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
  });

  assertEquals(globalThis.tsera.env("PORT"), 8000);
  assertEquals(globalThis.tsera.env("DEBUG"), false);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - throws on missing required variable", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "PORT=3000\n");

  const schema = defineEnvSchema({
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "string", required: true },
  });

  await assertRejects(
    async () => {
      await initializeSecrets(schema, {
        secretsDir,
        environment: "dev",
      });
    },
    Error,
    "Missing required variable",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - parses types correctly", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  const envContent = `
STRING_VAR=hello
NUMBER_VAR=42
BOOL_TRUE=true
BOOL_FALSE=false
`;
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, envContent);

  const schema = defineEnvSchema({
    STRING_VAR: { type: "string", required: true },
    NUMBER_VAR: { type: "number", required: true },
    BOOL_TRUE: { type: "boolean", required: true },
    BOOL_FALSE: { type: "boolean", required: true },
  });

  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
  });

  assertEquals(globalThis.tsera.env("STRING_VAR"), "hello");
  assertEquals(globalThis.tsera.env("NUMBER_VAR"), 42);
  assertEquals(globalThis.tsera.env("BOOL_TRUE"), true);
  assertEquals(globalThis.tsera.env("BOOL_FALSE"), false);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - loads different environments", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "PORT=3000\n");
  await Deno.writeTextFile(`${secretsDir}/.env.prod`, "PORT=8080\n");

  const schema = defineEnvSchema({
    PORT: { type: "number", required: true },
  });

  // Test dev environment
  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
  });
  assertEquals(globalThis.tsera.env("PORT"), 3000);
  assertEquals(globalThis.tsera.currentEnvironment, "dev");

  // Test prod environment
  await initializeSecrets(schema, {
    secretsDir,
    environment: "prod",
  });
  assertEquals(globalThis.tsera.env("PORT"), 8080);
  assertEquals(globalThis.tsera.currentEnvironment, "prod");

  await Deno.remove(tempDir, { recursive: true });
});
