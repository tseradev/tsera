import type { EntityDef } from "./entity.ts";
import type * as FallbackModule from "../deps/polyfills/drizzle.ts";

export type { Dialect } from "../deps/polyfills/drizzle.ts";

let fallbackModule: typeof FallbackModule | null = null;

try {
  await import("npm:drizzle-orm@0.30.10");
} catch {
  fallbackModule = await import("../deps/polyfills/drizzle.ts");
}

if (!fallbackModule) {
  fallbackModule = await import("../deps/polyfills/drizzle.ts");
}

export function entityToDDL(
  entity: EntityDef,
  dialect: FallbackModule.Dialect = "postgres",
): string {
  return fallbackModule!.entityToDDL(entity, dialect);
}
