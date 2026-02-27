/**
 * SQLite database connection using Drizzle ORM with libsql.
 *
 * This module provides centralized database connection management with:
 * - Lazy initialization via getDb()
 * - Type-safe Drizzle ORM client
 * - Schema exports for use in routes
 * - Automatic directory creation for local SQLite files
 *
 * @module
 */

import { type Client, createClient } from "@libsql/client";
import {
  getDatabaseCredentials,
  resolveDatabaseProvider,
} from "@tsera/core";
import { drizzle } from "drizzle-orm/libsql";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============================================================================
// Types
// ============================================================================

/**
 * Cached database connection state.
 */
type DbConnection = {
  client: Client;
  db: ReturnType<typeof drizzle>;
  url: string;
};

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

/**
 * Schema exports for use in queries.
 */
export const schema = {
  slogans,
  users,
};

// ============================================================================
// Database Connection
// ============================================================================

/** Cached database connection (singleton). */
let connection: DbConnection | null = null;

/**
 * Ensures the directory for the SQLite database file exists.
 *
 * @param dbUrl - Database URL (file: prefix)
 */
async function ensureDatabaseDirectory(dbUrl: string): Promise<void> {
  const filePath = dbUrl.replace(/^file:/, "");
  const lastSlash = filePath.lastIndexOf("/");
  const dirPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ".";

  try {
    await Deno.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

/**
 * Create tables if they don't exist.
 * Useful for development mode where migrations may not have been run.
 *
 * @param client - libsql client
 */
async function createTablesIfNotExist(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS slogans (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL
    )
  `);

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
 * Initialize the database connection.
 *
 * @returns Database connection state
 * @throws Error if configuration is invalid
 */
async function initializeConnection(): Promise<DbConnection> {
  const provider = resolveDatabaseProvider();
  const url = getDatabaseCredentials("sqlite");

  await ensureDatabaseDirectory(url);

  const client = createClient({ url });
  const db = drizzle(client, { schema });

  await createTablesIfNotExist(client);

  return { client, db, url };
}

/**
 * Get the Drizzle ORM database instance.
 * Initializes the connection on first call (lazy initialization).
 *
 * @returns Drizzle ORM instance
 *
 * @example
 * ```ts
 * const db = await getDb();
 * const allUsers = await db.select().from(users);
 * ```
 */
export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (!connection) {
    connection = await initializeConnection();
  }
  return connection.db;
}

/**
 * Get the underlying libsql client.
 * Useful for raw queries or advanced operations.
 *
 * @returns libsql client
 */
export async function getClient(): Promise<Client> {
  if (!connection) {
    connection = await initializeConnection();
  }
  return connection.client;
}

/**
 * Get the resolved database URL.
 *
 * @returns Database URL
 */
export async function getDatabaseUrl(): Promise<string> {
  if (!connection) {
    connection = await initializeConnection();
  }
  return connection.url;
}

/**
 * Initialize database at application startup.
 * Call this to eagerly initialize the connection.
 */
export async function initDb(): Promise<void> {
  await getDb();
}
