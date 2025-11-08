/**
 * Re-exports testing assertions from Deno standard library.
 *
 * This module provides a subset of commonly used assertions for the Hono module.
 * For the full set of assertions, use the base template's `test-utils/asserts.ts`.
 *
 * @module
 */

export {
  assertEquals,
  assertExists,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
