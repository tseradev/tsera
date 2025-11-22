/**
 * Drizzle ORM configuration.
 *
 * This configuration file is used by the Drizzle CLI for migrations
 * and other database operations.
 *
 * @module
 */

// Install drizzle-kit first: deno add npm:drizzle-kit
// After installation, uncomment the import below:
// import type { Config } from "drizzle-kit";

// Get database URL from environment
const databaseUrl = Deno.env.get("DATABASE_URL") ??
  Deno.env.get("TSERA_DATABASE_URL");

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or TSERA_DATABASE_URL must be set in your environment",
  );
}

/**
 * Drizzle Kit configuration.
 *
 * - schema: Path to your generated schema files (managed by TSera)
 * - out: Output directory for migration files
 * - dialect: Database dialect (postgres, mysql, or sqlite)
 *
 * NOTE: Uncomment the import and use `satisfies Config` after installing drizzle-kit
 */
export default {
  schema: "./.tsera/schemas/*.schema.ts",
  out: "./app/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  // satisfies Config; // Uncomment after installing drizzle-kit
};

