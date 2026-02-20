/**
 * SQLite database connection using Drizzle ORM with libsql.
 *
 * This module centralizes database connection and provides:
 * - Drizzle ORM client for type-safe queries
 * - Schema exports for use in routes
 * - Automatic directory creation for local SQLite files
 *
 * @module
 */

import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============================================================================
// Types
// ============================================================================

type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

// ============================================================================
// Environment Resolution
// ============================================================================

/**
 * Resolve the TSera runtime env accessor if the secrets module is enabled.
 */
function resolveTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["tsera"];
  if (!isTseraEnvAccessor(tsera)) {
    return undefined;
  }
  return tsera;
}

/**
 * Resolve the database provider from environment.
 */
function resolveDatabaseProvider(): string {
  const tseraEnv = resolveTseraEnv();
  const provider = readEnvString(tseraEnv?.env("DATABASE_PROVIDER")) ??
    Deno.env.get("DATABASE_PROVIDER");

  if (provider !== "sqlite") {
    throw new Error(
      `DATABASE_PROVIDER must be "sqlite". Got: ${provider ?? "undefined"}`,
    );
  }

  return provider;
}

/**
 * Resolve the database URL, preferring tsera.env when available.
 */
function resolveDatabaseUrl(): string {
  const tseraEnv = resolveTseraEnv();
  const databaseUrl = readEnvString(tseraEnv?.env("DATABASE_URL")) ??
    readEnvString(tseraEnv?.env("TSERA_DATABASE_URL")) ??
    Deno.env.get("DATABASE_URL") ??
    Deno.env.get("TSERA_DATABASE_URL");

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it in your environment or config/secrets/.env.* file.",
    );
  }

  // Validate URL format for SQLite (must start with file:)
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL must start with "file:" for SQLite. Got: ${databaseUrl}`,
    );
  }

  return databaseUrl;
}

// ============================================================================
// Database Directory Setup
// ============================================================================

/**
 * Ensures the directory for the SQLite database file exists.
 */
async function ensureDatabaseDirectory(dbUrl: string): Promise<void> {
  // Extract path from file: URL
  const filePath = dbUrl.replace(/^file:/, "");

  // Get directory path
  const lastSlash = filePath.lastIndexOf("/");
  const dirPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ".";

  try {
    await Deno.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Slogans table schema.
 * Generated from core/entities/Slogan.ts entity definition.
 */
export const slogans = sqliteTable("slogans", {
  id: integer("id").primaryKey(),
  text: text("text").notNull(),
});

/**
 * Users table schema.
 * Generated from core/entities/User.ts entity definition.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  motDePasse: text("mot_de_passe").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Database Client Initialization
// ============================================================================

/**
 * Initialize the libsql client and Drizzle ORM.
 */
async function initializeDatabase(): Promise<{
  client: Client;
  db: ReturnType<typeof drizzle>;
}> {
  // Validate environment
  resolveDatabaseProvider();
  const databaseUrl = resolveDatabaseUrl();

  // Ensure directory exists for local files
  await ensureDatabaseDirectory(databaseUrl);

  // Create libsql client
  const client = createClient({
    url: databaseUrl,
  });

  // Create Drizzle ORM instance
  const db = drizzle(client, {
    schema: { slogans, users },
  });

  return { client, db };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Database URL (throws if missing or invalid).
 */
export const databaseUrl = resolveDatabaseUrl();

/**
 * Database provider (validated to be "sqlite").
 */
export const databaseProvider = resolveDatabaseProvider();

/**
 * Schema exports for use in queries.
 */
export const schema = {
  slogans,
  users,
};

/**
 * Promise that resolves to the database client and Drizzle instance.
 * Use this for async initialization.
 */
let dbPromise:
  | Promise<{
    client: Client;
    db: ReturnType<typeof drizzle>;
  }>
  | null = null;

/**
 * Get or create the database connection.
 */
export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }
  const { db } = await dbPromise;
  return db;
}

/**
 * Synchronous database export for convenience.
 * Note: This will be undefined until the database is initialized.
 * Use getDb() for async initialization or call initDb() at startup.
 */
export let db: ReturnType<typeof drizzle> | undefined = undefined;

/**
 * Create tables if they don't exist.
 * This is useful for development mode where migrations may not have been run.
 */
async function createTablesIfNotExist(client: Client): Promise<void> {
  // Create slogans table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS slogans (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL
    )
  `);

  // Create users table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      mot_de_passe TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

/**
 * Initialize the database connection synchronously.
 * Call this at application startup.
 */
export async function initDb(): Promise<void> {
  const { client, db: drizzleInstance } = await initializeDatabase();

  // Create tables if they don't exist (useful for development)
  await createTablesIfNotExist(client);

  db = drizzleInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

function readEnvString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isTseraEnvAccessor(value: unknown): value is TseraEnvAccessor {
  return isRecord(value) && typeof value["env"] === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
