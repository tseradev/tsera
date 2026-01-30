/**
 * Database seed example.
 *
 * Seeds are used to populate the database with initial or test data.
 * Run seeds manually with: deno run -A app/db/seeds/example.seed.ts
 *
 * @module
 */

// import { db } from "../connect.ts";
// import { users } from "../schema.ts";

/**
 * Seed example users.
 *
 * This is a template - adapt it to your actual schema once entities are defined.
 */
async function seedUsers(): Promise<void> {
  console.log("Seeding users...");

  // Example: Insert users (adapt to your actual schema)
  /*
  await db.insert(users).values([
    {
      id: "1",
      email: "admin@example.com",
      displayName: "Admin User",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "2",
      email: "user@example.com",
      displayName: "Regular User",
      isActive: true,
      createdAt: new Date(),
    },
  ]);
  */

  console.log("Users seeded successfully!");
}

/**
 * Main seed function.
 */
async function main(): Promise<void> {
  try {
    console.log("Starting database seed...");
    await seedUsers();
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
