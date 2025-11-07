import type * as ZodPolyfill from "../../deps/polyfills/zod.ts";

type ZodModule = typeof ZodPolyfill;

let zodModule: ZodModule;

try {
  zodModule = await import("jsr:@zod@1");
} catch {
  zodModule = await import("../../deps/polyfills/zod.ts");
}

const { z, SchemaError } = zodModule;

/**
 * Zod schema library instance, resolved from JSR or fallback polyfill.
 */
export { SchemaError, z };
export type {
  SchemaError as SchemaErrorType,
  ZodObject,
  ZodTypeAny,
} from "../../deps/polyfills/zod.ts";
