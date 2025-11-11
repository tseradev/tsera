/**
 * Tests for secret store with encryption.
 */

import { assertEquals, assertExists, assertRejects } from "std/assert/mod.ts";
import { createSecretStore, resetWarningCache } from "./store.ts";
import { join } from "../../shared/path.ts";

// Helper to create a unique temp directory for each test
async function createTempDir(): Promise<string> {
  const tempDir = await Deno.makeTempDir();
  return tempDir;
}

// Helper to cleanup temp directory
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch {
    // Ignore errors during cleanup
  }
}

Deno.test("createSecretStore - without encryption key", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Capture console.warn output
    const originalWarn = console.warn;
    let warnCalled = false;
    let warnMessage = "";
    console.warn = (msg: string) => {
      warnCalled = true;
      warnMessage = msg;
    };

    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: undefined,
    });

    // Restore console.warn
    console.warn = originalWarn;

    assertExists(store);
    assertEquals(warnCalled, true, "Warning should be displayed");
    assertEquals(
      warnMessage.includes("Store not encrypted"),
      true,
      "Warning should mention store not encrypted",
    );

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("createSecretStore - with encryption key", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    assertExists(store);
    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("createSecretStore - warns on weak encryption key", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Reset warning cache to ensure this test can verify the warning
    resetWarningCache();

    // Capture console.warn output
    const originalWarn = console.warn;
    let warnCalled = false;
    let warnMessage = "";
    console.warn = (msg: string) => {
      warnCalled = true;
      warnMessage = msg;
    };

    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "short", // Less than 32 chars
    });

    // Restore console.warn
    console.warn = originalWarn;

    assertExists(store);
    assertEquals(warnCalled, true, "Warning should be displayed");
    assertEquals(
      warnMessage.includes("Weak encryption key"),
      true,
      "Warning should mention weak key",
    );

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - set/get clear value", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Silence warning
    const originalWarn = console.warn;
    console.warn = () => { };

    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: undefined, // No encryption
    });

    console.warn = originalWarn;

    // Set a value
    await store.set("dev", "DATABASE_URL", "postgres://localhost:5432/db");

    // Get the value back
    const value = await store.get("dev", "DATABASE_URL");
    assertEquals(value, "postgres://localhost:5432/db");

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - set/get encrypted value", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    // Set a value
    await store.set("dev", "DATABASE_URL", "postgres://localhost:5432/db");

    // Get the value back
    const value = await store.get("dev", "DATABASE_URL");
    assertEquals(value, "postgres://localhost:5432/db");

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - set/get complex value types", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    // Test different types
    await store.set("dev", "PORT", 8080);
    await store.set("dev", "DEBUG", true);
    await store.set("dev", "CONFIG", { host: "localhost", timeout: 5000 });

    assertEquals(await store.get("dev", "PORT"), 8080);
    assertEquals(await store.get("dev", "DEBUG"), true);
    assertEquals(await store.get("dev", "CONFIG"), {
      host: "localhost",
      timeout: 5000,
    });

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - environment isolation", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    // Set values in different environments
    await store.set("dev", "DATABASE_URL", "postgres://dev:5432/db");
    await store.set("prod", "DATABASE_URL", "postgres://prod:5432/db");

    // Verify isolation
    assertEquals(
      await store.get("dev", "DATABASE_URL"),
      "postgres://dev:5432/db",
    );
    assertEquals(
      await store.get("prod", "DATABASE_URL"),
      "postgres://prod:5432/db",
    );

    // Verify key doesn't exist in wrong environment
    assertEquals(await store.get("preprod", "DATABASE_URL"), undefined);

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - getAll returns all secrets for environment", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    // Set multiple values in dev
    await store.set("dev", "DATABASE_URL", "postgres://localhost:5432/db");
    await store.set("dev", "PORT", 8080);
    await store.set("dev", "DEBUG", true);

    // Set a value in prod (should not appear in dev results)
    await store.set("prod", "DATABASE_URL", "postgres://prod:5432/db");

    // Get all dev secrets
    const devSecrets = await store.getAll("dev");

    assertEquals(Object.keys(devSecrets).length, 3);
    assertEquals(devSecrets["DATABASE_URL"], "postgres://localhost:5432/db");
    assertEquals(devSecrets["PORT"], 8080);
    assertEquals(devSecrets["DEBUG"], true);

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - salt is persistent", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Create first store
    const store1 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });
    store1.close();

    // Read salt file
    const saltPath = join(tseraDir, "salt");
    const salt1 = await Deno.readFile(saltPath);

    // Create second store (should reuse salt)
    const store2 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });
    store2.close();

    // Read salt again
    const salt2 = await Deno.readFile(saltPath);

    // Verify salt is the same
    assertEquals(salt1.length, 32);
    assertEquals(salt2.length, 32);
    assertEquals(salt1, salt2);
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - decrypt with same key works", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Store 1: Encrypt and store
    const store1 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    await store1.set("dev", "SECRET", "my-secret-value");
    store1.close();

    // Store 2: Decrypt with same passphrase
    const store2 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    const value = await store2.get("dev", "SECRET");
    assertEquals(value, "my-secret-value");

    store2.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - cannot decrypt without key", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    // Store 1: Encrypt and store
    const store1 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    await store1.set("dev", "SECRET", "my-secret-value");
    store1.close();

    // Silence warning
    const originalWarn = console.warn;
    console.warn = () => { };

    // Store 2: Try to decrypt without key
    const store2 = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: undefined, // No key provided
    });

    console.warn = originalWarn;

    // Should throw error when trying to get encrypted value
    await assertRejects(
      async () => {
        await store2.get("dev", "SECRET");
      },
      Error,
      "Cannot decrypt secret",
    );

    store2.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - get returns undefined for non-existent key", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    const value = await store.get("dev", "NON_EXISTENT");
    assertEquals(value, undefined);

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});

Deno.test("store - getAll returns empty object for environment with no secrets", async () => {
  const tempDir = await createTempDir();
  const kvPath = join(tempDir, "kv");
  const tseraDir = tempDir;

  try {
    const store = await createSecretStore({
      kvPath,
      tseraDir,
      encryptionKey: "a-very-strong-32-character-key!",
    });

    const secrets = await store.getAll("empty-env");
    assertEquals(secrets, {});

    store.close();
  } finally {
    await cleanupTempDir(tempDir);
  }
});
