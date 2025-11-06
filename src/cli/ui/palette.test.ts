import { assertEquals } from "../../testing/asserts.ts";
import { createPalette } from "./palette.ts";

Deno.test("createPalette returns palette with all methods", () => {
  const palette = createPalette();

  // Check all required methods exist
  assertEquals(typeof palette.accent, "function");
  assertEquals(typeof palette.strong, "function");
  assertEquals(typeof palette.subtle, "function");
  assertEquals(typeof palette.label, "function");
  assertEquals(typeof palette.heading, "function");
  assertEquals(typeof palette.highlight, "function");
  assertEquals(typeof palette.success, "function");
});

Deno.test("createPalette accepts custom theme", () => {
  const customTheme = {
    accent: (text: string) => `[ACCENT]${text}`,
    strong: (text: string) => `[STRONG]${text}`,
  };

  const palette = createPalette(customTheme);

  assertEquals(palette.accent("test"), "[ACCENT]test");
  assertEquals(palette.strong("test"), "[STRONG]test");
  // Other methods should still work with defaults
  assertEquals(typeof palette.subtle("test"), "string");
});

Deno.test("createPalette methods return strings", () => {
  const palette = createPalette();
  const text = "test";

  assertEquals(typeof palette.accent(text), "string");
  assertEquals(typeof palette.strong(text), "string");
  assertEquals(typeof palette.subtle(text), "string");
  assertEquals(typeof palette.label(text), "string");
  assertEquals(typeof palette.heading(text), "string");
  assertEquals(typeof palette.highlight(text), "string");
  assertEquals(typeof palette.success(text), "string");
});
