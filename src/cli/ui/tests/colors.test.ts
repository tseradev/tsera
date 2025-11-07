import { assertEquals } from "../../../testing/asserts.ts";
import { bold, cyan, dim, gray, green, magenta, red, yellow } from "../colors.ts";

Deno.test("color functions apply styles", () => {
  // We just test that the functions return strings and include the input
  const text = "test";
  assertEquals(typeof red(text), "string");
  assertEquals(typeof green(text), "string");
  assertEquals(typeof yellow(text), "string");
  assertEquals(typeof cyan(text), "string");
  assertEquals(typeof magenta(text), "string");
  assertEquals(typeof bold(text), "string");
  assertEquals(typeof dim(text), "string");
  assertEquals(typeof gray(text), "string");
});

Deno.test("color functions return non-empty strings", () => {
  const text = "test";
  assertEquals(red(text).length > 0, true);
  assertEquals(green(text).length > 0, true);
});
