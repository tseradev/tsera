/**
 * Placeholder artifact generator for Zod schema mirrors.
 */

import type { ZodSchemaLike } from "../../../core/schema.ts";

export async function emitZodSchema(name: string, schema: ZodSchemaLike): Promise<void> {
  await Promise.resolve();
  console.log(`Génération Zod (placeholder): ${name} -> ${Object.keys(schema.shape).join(",")}`);
}
