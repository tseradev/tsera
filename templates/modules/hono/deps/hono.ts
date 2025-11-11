/**
 * Hono framework re-exports for TSera projects.
 *
 * This module centralizes Hono imports and re-exports commonly used types
 * and classes. The actual Hono package is imported via the import_map.json
 * configuration (jsr:@hono/hono).
 *
 * @module
 */

export { Hono } from "hono";
export type { Context, Env, Handler, Input, Schema, ToSchema } from "hono";
export type { HonoRequest } from "hono";

/**
 * Re-export the router type for convenience.
 */
export type HonoRouter = ReturnType<typeof import("hono").Hono.prototype.route>;
