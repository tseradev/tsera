/**
 * Drizzle ORM configuration for SQLite.
 *
 * This configuration file is used by the Drizzle CLI for migrations
 * and other database operations.
 *
 * @module
 */

// If you choose to use drizzle-kit, install it and uncomment the import below:
// import type { Config } from "drizzle-kit";

// Get database URL from environment
const databaseUrl = Deno.env.get("DATABASE_URL") ??
  Deno.env.get("TSERA_DATABASE_URL");

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or TSERA_DATABASE_URL must be set in your environment",
  );
}

// Validate SQLite URL format
if (!databaseUrl.startsWith("file:")) {
  throw new Error(
    `DATABASE_URL must start with "file:" for SQLite. Got: ${databaseUrl}`,
  );
}

/**
 * Drizzle Kit configuration for SQLite.
 *
 * - schema: Path to your generated schema files (managed by TSera)
 * - out: Output directory for migration files
 * - dialect: Database dialect (sqlite for libsql/SQLite)
 *
 * NOTE: Uncomment the import and use `satisfies Config` after installing drizzle-kit
 */
export default {
  schema: "./.tsera/schemas/*.schema.ts",
  out: "./app/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
  // satisfies Config;
};
