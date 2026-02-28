import { assertEquals, assertThrows } from "std/assert";
import {
  createDrizzleConfig,
  createMysqlConfig,
  createPostgresConfig,
  createSqliteConfig,
  getDatabaseCredentials,
  resolveDatabaseProvider,
  resolveDatabaseUrl,
  validateDatabaseConfig,
} from "../drizzle-config.ts";

// ============================================================================
// Test Setup & Cleanup
// ============================================================================

const originalEnv: Record<string, string | undefined> = {};

function backupEnv(keys: string[]) {
  for (const key of keys) {
    originalEnv[key] = Deno.env.get(key);
  }
}

function restoreEnv(keys: string[]) {
  for (const key of keys) {
    const value = originalEnv[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

// ============================================================================
// resolveDatabaseUrl Tests
// ============================================================================

Deno.test("resolveDatabaseUrl - returns URL when DATABASE_URL is set", () => {
  const keys = ["DATABASE_URL", "TSERA_DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    const url = resolveDatabaseUrl();
    assertEquals(url, "file:test.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - falls back to TSERA_DATABASE_URL", () => {
  const keys = ["DATABASE_URL", "TSERA_DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.delete("DATABASE_URL");
    Deno.env.set("TSERA_DATABASE_URL", "file:fallback.db");
    const url = resolveDatabaseUrl();
    assertEquals(url, "file:fallback.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - prefers DATABASE_URL over TSERA_DATABASE_URL", () => {
  const keys = ["DATABASE_URL", "TSERA_DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:primary.db");
    Deno.env.set("TSERA_DATABASE_URL", "file:fallback.db");
    const url = resolveDatabaseUrl();
    assertEquals(url, "file:primary.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - throws when no URL is set", () => {
  const keys = ["DATABASE_URL", "TSERA_DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.delete("DATABASE_URL");
    Deno.env.delete("TSERA_DATABASE_URL");
    assertThrows(
      () => resolveDatabaseUrl(),
      Error,
      "Database URL not found",
    );
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - validates URL prefix when expectedPrefix is set", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    assertThrows(
      () =>
        resolveDatabaseUrl({
          expectedPrefix: "postgresql:",
        }),
      Error,
      'must start with "postgresql:"',
    );
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - accepts valid prefix", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    const url = resolveDatabaseUrl({ expectedPrefix: "file:" });
    assertEquals(url, "file:test.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseUrl - supports custom env keys", () => {
  const keys = ["CUSTOM_DB_URL", "DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.delete("DATABASE_URL");
    Deno.env.set("CUSTOM_DB_URL", "file:custom.db");
    const url = resolveDatabaseUrl({
      envKeys: ["CUSTOM_DB_URL"],
    });
    assertEquals(url, "file:custom.db");
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// resolveDatabaseProvider Tests
// ============================================================================

Deno.test("resolveDatabaseProvider - returns provider when set", () => {
  const keys = ["DATABASE_PROVIDER"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_PROVIDER", "sqlite");
    const provider = resolveDatabaseProvider();
    assertEquals(provider, "sqlite");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseProvider - throws when not set", () => {
  const keys = ["DATABASE_PROVIDER"];
  backupEnv(keys);
  try {
    Deno.env.delete("DATABASE_PROVIDER");
    assertThrows(
      () => resolveDatabaseProvider(),
      Error,
      "DATABASE_PROVIDER is required",
    );
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("resolveDatabaseProvider - throws for invalid provider", () => {
  const keys = ["DATABASE_PROVIDER"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_PROVIDER", "invalid");
    assertThrows(
      () => resolveDatabaseProvider(),
      Error,
      "DATABASE_PROVIDER must be one of",
    );
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// createSqliteConfig Tests
// ============================================================================

Deno.test("createSqliteConfig - creates valid SQLite config", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    const config = createSqliteConfig();
    assertEquals(config.dialect, "sqlite");
    assertEquals(config.schema, "./.tsera/db/schemas/*.ts");
    assertEquals(config.out, "./.tsera/db/migrations");
    assertEquals(config.dbCredentials.url, "file:test.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("createSqliteConfig - accepts custom options", () => {
  const config = createSqliteConfig({
    schema: "./custom/schemas/*.ts",
    out: "./custom/migrations",
    databaseUrl: "file:custom.db",
  });
  assertEquals(config.schema, "./custom/schemas/*.ts");
  assertEquals(config.out, "./custom/migrations");
  assertEquals(config.dbCredentials.url, "file:custom.db");
});

Deno.test("createSqliteConfig - validates SQLite URL prefix", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "postgresql://localhost/db");
    assertThrows(
      () => createSqliteConfig(),
      Error,
      'must start with "file:"',
    );
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// createPostgresConfig Tests
// ============================================================================

Deno.test("createPostgresConfig - creates valid PostgreSQL config", () => {
  const config = createPostgresConfig({
    databaseUrl: "postgresql://localhost/db",
  });
  assertEquals(config.dialect, "postgresql");
  assertEquals(config.dbCredentials.url, "postgresql://localhost/db");
});

Deno.test("createPostgresConfig - includes SSL option", () => {
  const keys = ["DATABASE_SSL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_SSL", "require");
    const config = createPostgresConfig({
      databaseUrl: "postgresql://localhost/db",
    });
    assertEquals(config.dbCredentials.ssl, "require");
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// createMysqlConfig Tests
// ============================================================================

Deno.test("createMysqlConfig - creates valid MySQL config", () => {
  const config = createMysqlConfig({
    databaseUrl: "mysql://localhost/db",
  });
  assertEquals(config.dialect, "mysql");
  assertEquals(config.dbCredentials.url, "mysql://localhost/db");
});

Deno.test("createMysqlConfig - includes SSL option", () => {
  const keys = ["DATABASE_SSL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_SSL", "true");
    const config = createMysqlConfig({
      databaseUrl: "mysql://localhost/db",
    });
    assertEquals(config.dbCredentials.ssl, true);
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// createDrizzleConfig Tests
// ============================================================================

Deno.test("createDrizzleConfig - creates SQLite config by default", () => {
  const config = createDrizzleConfig({
    databaseUrl: "file:test.db",
  });
  assertEquals(config.dialect, "sqlite");
});

Deno.test("createDrizzleConfig - creates PostgreSQL config when specified", () => {
  const config = createDrizzleConfig({
    dialect: "postgresql",
    databaseUrl: "postgresql://localhost/db",
  });
  assertEquals(config.dialect, "postgresql");
});

Deno.test("createDrizzleConfig - creates MySQL config when specified", () => {
  const config = createDrizzleConfig({
    dialect: "mysql",
    databaseUrl: "mysql://localhost/db",
  });
  assertEquals(config.dialect, "mysql");
});

// ============================================================================
// getDatabaseCredentials Tests
// ============================================================================

Deno.test("getDatabaseCredentials - returns URL for valid SQLite config", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    const url = getDatabaseCredentials("sqlite");
    assertEquals(url, "file:test.db");
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("getDatabaseCredentials - validates prefix for dialect", () => {
  const keys = ["DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_URL", "file:test.db");
    assertThrows(
      () => getDatabaseCredentials("postgresql"),
      Error,
      "postgresql:",
    );
  } finally {
    restoreEnv(keys);
  }
});

// ============================================================================
// validateDatabaseConfig Tests
// ============================================================================

Deno.test("validateDatabaseConfig - returns true for valid config", () => {
  const keys = ["DATABASE_PROVIDER", "DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_PROVIDER", "sqlite");
    Deno.env.set("DATABASE_URL", "file:test.db");
    const result = validateDatabaseConfig();
    assertEquals(result, true);
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("validateDatabaseConfig - throws for missing provider", () => {
  const keys = ["DATABASE_PROVIDER", "DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.delete("DATABASE_PROVIDER");
    Deno.env.set("DATABASE_URL", "file:test.db");
    assertThrows(
      () => validateDatabaseConfig(),
      Error,
      "DATABASE_PROVIDER is required",
    );
  } finally {
    restoreEnv(keys);
  }
});

Deno.test("validateDatabaseConfig - throws for missing URL", () => {
  const keys = ["DATABASE_PROVIDER", "DATABASE_URL"];
  backupEnv(keys);
  try {
    Deno.env.set("DATABASE_PROVIDER", "sqlite");
    Deno.env.delete("DATABASE_URL");
    assertThrows(
      () => validateDatabaseConfig(),
      Error,
      "Database URL not found",
    );
  } finally {
    restoreEnv(keys);
  }
});
