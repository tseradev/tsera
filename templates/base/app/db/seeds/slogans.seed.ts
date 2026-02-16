/**
 * Database seed for slogans table.
 *
 * This seed populates the slogans table with initial data.
 * It is idempotent - it will not duplicate data if run multiple times.
 *
 * Run manually with: deno run -A app/db/seeds/slogans.seed.ts
 *
 * @module
 */

import { eq } from "drizzle-orm";
import { db, slogans } from "../connect.ts";

/**
 * Default slogans to seed.
 */
const DEFAULT_SLOGANS = [
  { id: 1, text: "Minimal by design." },
  { id: 2, text: "Scalable by default." },
] as const;

/**
 * Seed the slogans table with default data.
 *
 * This function is idempotent:
 * - Checks if each slogan already exists by ID
 * - Only inserts slogans that don't exist
 * - Safe to run multiple times
 */
async function seedSlogans(): Promise<void> {
  if (!db) {
    throw new Error(
      "Database connection is not initialized. Call initDb() first.",
    );
  }

  console.log("Seeding slogans...");

  for (const slogan of DEFAULT_SLOGANS) {
    // Check if slogan already exists
    const existing = await db.select().from(slogans).where(
      eq(slogans.id, slogan.id),
    );

    if (existing.length === 0) {
      // Insert only if not present
      await db.insert(slogans).values({
        id: slogan.id,
        text: slogan.text,
      });
      console.log(`  Inserted slogan ${slogan.id}: "${slogan.text}"`);
    } else {
      console.log(`  Slogan ${slogan.id} already exists, skipping`);
    }
  }

  console.log("Slogans seeded successfully!");
}

/**
 * Main seed function.
 */
async function main(): Promise<void> {
  try {
    console.log("Starting slogans seed...");
    await seedSlogans();
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    Deno.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main();
}

// Export for programmatic use
export { seedSlogans };
