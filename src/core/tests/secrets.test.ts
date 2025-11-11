/**
 * Tests for the secrets management system.
 *
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "std/assert";
import { defineEnvSchema, initializeSecrets, parseEnvFile } from "../secrets.ts";

Deno.test("parseEnvFile - parses simple key=value format", () => {
  const content = `
PORT=8000
DATABASE_URL=postgresql://localhost:5432/test
DEBUG=true
`;

  const result = parseEnvFile(content);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/test");
  assertEquals(result.DEBUG, "true");
});

Deno.test("parseEnvFile - ignores comments and empty lines", () => {
  const content = `
# This is a comment
PORT=8000

# Another comment
DATABASE_URL=postgresql://localhost:5432/test
`;

  const result = parseEnvFile(content);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/test");
  assertEquals(Object.keys(result).length, 2);
});

Deno.test("parseEnvFile - handles quoted values", () => {
  const content = `
MESSAGE="Hello, World!"
PATH='/usr/local/bin'
`;

  const result = parseEnvFile(content);

  assertEquals(result.MESSAGE, "Hello, World!");
  assertEquals(result.PATH, "/usr/local/bin");
});

Deno.test("parseEnvFile - handles values with equals signs", () => {
  const content = `
CONNECTION_STRING=postgresql://user:pass=word@localhost:5432/db
`;

  const result = parseEnvFile(content);

  assertEquals(result.CONNECTION_STRING, "postgresql://user:pass=word@localhost:5432/db");
});

Deno.test("defineEnvSchema - creates schema with default environments", () => {
  const schema = defineEnvSchema({
    PORT: {
      type: "number",
      required: false,
      default: 8000,
    },
  });

  assertEquals(schema.environments, ["dev", "preprod", "prod"]);
  assertEquals(schema.vars.PORT.type, "number");
});

Deno.test("defineEnvSchema - accepts custom environments", () => {
  const schema = defineEnvSchema(
    {
      PORT: {
        type: "number",
        required: true,
      },
    },
    ["local", "staging", "production"],
  );

  assertEquals(schema.environments, ["local", "staging", "production"]);
});

Deno.test("initializeSecrets - loads and validates environment variables", async () => {
  // Create a temporary directory for test
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Create a test .env.dev file
  const envContent = `
PORT=3000
DATABASE_URL=postgresql://localhost:5432/test_db
DEBUG=true
`;
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, envContent);

  // Define schema
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

  // Initialize secrets (without KV store for this test)
  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
    useStore: false,
  });

  // Check that global API is available
  assertExists(globalThis.tsera);
  assertEquals(globalThis.tsera.currentEnvironment, "dev");
  assertEquals(globalThis.tsera.env("PORT"), 3000);
  assertEquals(globalThis.tsera.env("DATABASE_URL"), "postgresql://localhost:5432/test_db");
  assertEquals(globalThis.tsera.env("DEBUG"), true);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - uses default environment from TSERA_ENV", async () => {
  // Create a temporary directory for test
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Create a test .env.prod file
  const envContent = `PORT=8080\nDEBUG=false`;
  await Deno.writeTextFile(`${secretsDir}/.env.prod`, envContent);

  // Set TSERA_ENV
  const originalEnv = Deno.env.get("TSERA_ENV");
  Deno.env.set("TSERA_ENV", "prod");

  // Define schema
  const schema = defineEnvSchema({
    PORT: {
      type: "number",
      required: true,
    },
    DEBUG: {
      type: "boolean",
      required: true,
    },
  });

  // Initialize secrets (should use prod from TSERA_ENV, without KV store)
  await initializeSecrets(schema, { secretsDir, useStore: false });

  // Check
  assertEquals(globalThis.tsera.currentEnvironment, "prod");
  assertEquals(globalThis.tsera.env("PORT"), 8080);
  assertEquals(globalThis.tsera.env("DEBUG"), false);

  // Cleanup
  if (originalEnv !== undefined) {
    Deno.env.set("TSERA_ENV", originalEnv);
  } else {
    Deno.env.delete("TSERA_ENV");
  }
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - throws on unknown environment", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  const schema = defineEnvSchema({
    PORT: { type: "number", required: true },
  });

  await assertRejects(
    async () => {
      await initializeSecrets(schema, {
        secretsDir,
        environment: "staging", // Not in default environments
        useStore: false,
      });
    },
    Error,
    "Unknown environment",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - throws on missing required variable", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Create .env.dev without required variable
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "PORT=3000\n");

  const schema = defineEnvSchema({
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "string", required: true }, // Required but missing
  });

  await assertRejects(
    async () => {
      await initializeSecrets(schema, {
        secretsDir,
        environment: "dev",
        useStore: false,
      });
    },
    Error,
    "Missing required variable: DATABASE_URL",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - throws on invalid type", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Create .env.dev with invalid number
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "PORT=not-a-number\n");

  const schema = defineEnvSchema({
    PORT: { type: "number", required: true },
  });

  await assertRejects(
    async () => {
      await initializeSecrets(schema, {
        secretsDir,
        environment: "dev",
        useStore: false,
      });
    },
    Error,
    "Cannot parse",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - uses default values for optional variables", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  // Create minimal .env.dev
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
    useStore: false,
  });

  assertEquals(globalThis.tsera.env("PORT"), 8000);
  assertEquals(globalThis.tsera.env("DEBUG"), false);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - validates boolean values correctly", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  const envContent = `
DEBUG_TRUE=true
DEBUG_FALSE=false
DEBUG_ONE=1
DEBUG_ZERO=0
`;
  await Deno.writeTextFile(`${secretsDir}/.env.dev`, envContent);

  const schema = defineEnvSchema({
    DEBUG_TRUE: { type: "boolean", required: true },
    DEBUG_FALSE: { type: "boolean", required: true },
    DEBUG_ONE: { type: "boolean", required: true },
    DEBUG_ZERO: { type: "boolean", required: true },
  });

  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
    useStore: false,
  });

  assertEquals(globalThis.tsera.env("DEBUG_TRUE"), true);
  assertEquals(globalThis.tsera.env("DEBUG_FALSE"), false);
  assertEquals(globalThis.tsera.env("DEBUG_ONE"), true);
  assertEquals(globalThis.tsera.env("DEBUG_ZERO"), false);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - validates custom validators", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "PORT=999\n");

  const schema = defineEnvSchema({
    PORT: {
      type: "number",
      required: true,
      validate: (value: unknown) => {
        const port = value as number;
        return port >= 1000 && port <= 65535;
      },
    },
  });

  await assertRejects(
    async () => {
      await initializeSecrets(schema, {
        secretsDir,
        environment: "dev",
        useStore: false,
      });
    },
    Error,
    "custom validator rejected value",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - persists to KV store when enabled", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  const kvPath = `${tempDir}/kv`;
  await Deno.mkdir(secretsDir);

  const schema = defineEnvSchema({
    DATABASE_URL: { type: "string", required: true },
    PORT: { type: "number", required: true },
  });

  await Deno.writeTextFile(
    `${secretsDir}/.env.dev`,
    "DATABASE_URL=postgres://localhost:5432/db\nPORT=8080",
  );

  // Initialize with KV store enabled
  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
    useStore: true,
    kvPath,
  });

  // Verify values are in memory
  assertEquals(globalThis.tsera.env("DATABASE_URL"), "postgres://localhost:5432/db");
  assertEquals(globalThis.tsera.env("PORT"), 8080);

  // Verify values were persisted to KV
  const { createSecretStore } = await import("../secrets/store.ts");
  const store = await createSecretStore({ kvPath });
  const storedUrl = await store.get("dev", "DATABASE_URL");
  const storedPort = await store.get("dev", "PORT");
  assertEquals(storedUrl, "postgres://localhost:5432/db");
  assertEquals(storedPort, 8080);
  store.close();

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - works without KV store", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  await Deno.mkdir(secretsDir);

  const schema = defineEnvSchema({
    TEST_VAR: { type: "string", required: true },
  });

  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "TEST_VAR=test123");

  // Initialize with KV store disabled
  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
    useStore: false,
  });

  // Verify value is still accessible (from memory)
  assertEquals(globalThis.tsera.env("TEST_VAR"), "test123");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("initializeSecrets - global API reads from memory, not KV", async () => {
  const tempDir = await Deno.makeTempDir();
  const secretsDir = `${tempDir}/secrets`;
  const kvPath = `${tempDir}/kv`;
  await Deno.mkdir(secretsDir);

  const schema = defineEnvSchema({
    VALUE: { type: "string", required: true },
  });

  await Deno.writeTextFile(`${secretsDir}/.env.dev`, "VALUE=original");

  // Initialize
  await initializeSecrets(schema, {
    secretsDir,
    environment: "dev",
    useStore: true,
    kvPath,
  });

  assertEquals(globalThis.tsera.env("VALUE"), "original");

  // Manually modify KV (simulating KV corruption or external change)
  const { createSecretStore } = await import("../secrets/store.ts");
  const store = await createSecretStore({ kvPath });
  await store.set("dev", "VALUE", "modified");
  store.close();

  // Global API should still return the original value from memory
  assertEquals(globalThis.tsera.env("VALUE"), "original");

  await Deno.remove(tempDir, { recursive: true });
});
