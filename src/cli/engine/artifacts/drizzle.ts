/**
 * Placeholder artifact generator for Drizzle migrations.
 */

export async function emitDrizzleMigration(name: string, sql: string): Promise<void> {
  await Promise.resolve();
  console.log(`Génération migration (placeholder): ${name}\n${sql}`);
}
