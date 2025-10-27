/**
 * Basic type guards to make future runtime checks expressive without pulling in
 * additional dependencies.
 */

import type { EntityDef } from "../entity.ts";

export function isEntity(value: unknown): value is EntityDef {
  return Boolean(
    value && typeof value === "object" && (value as EntityDef).__brand === "TSeraEntity",
  );
}
