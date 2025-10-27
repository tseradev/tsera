/**
 * Placeholder schema helpers. These will eventually translate TSera entities to
 * first-class Zod schemas but for now we expose the signatures so downstream
 * modules can compile against them.
 */

import type { EntityDef } from "./entity.ts";

export type ZodSchemaLike = {
  readonly shape: Record<string, unknown>;
};

export function entityToZod(entity: EntityDef): ZodSchemaLike {
  return {
    shape: Object.fromEntries(
      Object.entries(entity.columns).map(([key, column]) => [
        key,
        { ...column },
      ]),
    ),
  };
}
