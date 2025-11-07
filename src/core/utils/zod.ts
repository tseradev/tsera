import type * as ZodPolyfill from "../../deps/polyfills/zod.ts";

type ZodModule = typeof ZodPolyfill;

let zodModule: ZodModule;

try {
  zodModule = await import("jsr:@zod@1");
} catch {
  zodModule = await import("../../deps/polyfills/zod.ts");
}

const { z } = zodModule;

/**
 * Zod schema library instance, resolved from JSR or fallback polyfill.
 */
export { z };
export type { ZodObject, ZodTypeAny } from "../../deps/polyfills/zod.ts";
