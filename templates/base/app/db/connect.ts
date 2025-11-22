/**
 * Database connection and Drizzle ORM initialization.
 *
 * This module provides a configured database client and Drizzle instance
 * for the TSera application. It supports PostgreSQL, MySQL, and SQLite.
 *
 * @module
 */

// Install dependencies first: deno add npm:drizzle-orm npm:pg
// After installation, uncomment the imports below:
// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";

// Get database URL from environment
// Uses tsera.env() if available (after initializeSecrets), otherwise falls back to Deno.env
const tseraEnv = (globalThis as unknown as { tsera?: { env: (key: string) => unknown } }).tsera;
const databaseUrl = (tseraEnv?.env("DATABASE_URL") as string | undefined) ??
  Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it in your environment or config/secrets/.env.* file.",
  );
}

/**
 * PostgreSQL connection pool.
 *
 * This pool manages database connections efficiently and handles
 * automatic reconnection on failure.
 *
 * NOTE: Uncomment after installing dependencies (deno add npm:drizzle-orm npm:pg)
 */
// export const pool = new Pool({
//   connectionString: databaseUrl,
//   max: 10, // Maximum number of clients in the pool
//   idleTimeoutMillis: 30000, // Close idle clients after 30s
//   connectionTimeoutMillis: 2000, // Fail after 2s if connection can't be established
// });

/**
 * Drizzle ORM instance.
 *
 * Use this instance to perform database operations with type safety
 * and automatic query building.
 *
 * NOTE: Uncomment after installing dependencies (deno add npm:drizzle-orm npm:pg)
 *
 * @example
 * ```ts
 * import { db } from "@/app/db/connect.ts";
 * import { users } from "@/app/db/schema.ts";
 *
 * const allUsers = await db.select().from(users);
 * ```
 */
// export const db = drizzle(pool);

/**
 * Test database connection.
 *
 * NOTE: Uncomment after installing dependencies (deno add npm:drizzle-orm npm:pg)
 *
 * @returns Promise that resolves to true if connection is successful
 * @throws Error if connection fails
 */
// export async function testConnection(): Promise<boolean> {
//   const client = await pool.connect();
//   try {
//     await client.query("SELECT 1");
//     return true;
//   } finally {
//     client.release();
//   }
// }

/**
 * Close database connection pool.
 *
 * NOTE: Uncomment after installing dependencies (deno add npm:drizzle-orm npm:pg)
 *
 * Call this when shutting down the application to ensure
 * all connections are properly closed.
 */
// export async function closeConnection(): Promise<void> {
//   await pool.end();
// }

// For SQLite (uncomment and adapt if using SQLite):
/*
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const sqliteFile = "./data/tsera.sqlite";
const sqlite = new Database(sqliteFile);
export const db = drizzle(sqlite);

export async function testConnection(): Promise<boolean> {
  try {
    sqlite.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  sqlite.close();
}
*/

// For MySQL (uncomment and adapt if using MySQL):
/*
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  uri: databaseUrl,
});

export const db = drizzle(connection);

export async function testConnection(): Promise<boolean> {
  try {
    await connection.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await connection.end();
}
*/

