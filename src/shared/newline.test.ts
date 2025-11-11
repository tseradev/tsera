import { assertEquals } from "std/assert/mod.ts";
import { getPlatformNewline, normalizeNewlines } from "./newline.ts";

Deno.test("getPlatformNewline returns the current separator", () => {
  const newline = getPlatformNewline();
  if (Deno.build.os === "windows") {
    assertEquals(newline, "\r\n");
  } else {
    assertEquals(newline, "\n");
  }
});

Deno.test("normalizeNewlines replaces every line ending", () => {
  const input = "a\rb\nc\r\nd";
  assertEquals(normalizeNewlines(input, "\n"), "a\nb\nc\nd");
  assertEquals(normalizeNewlines(input, "\r\n"), "a\r\nb\r\nc\r\nd");
});
