import { assertEquals } from "../testing/asserts.ts";
import { getPlatformNewline, normalizeNewlines } from "./newline.ts";

Deno.test("getPlatformNewline retourne le séparateur courant", () => {
  const newline = getPlatformNewline();
  if (Deno.build.os === "windows") {
    assertEquals(newline, "\r\n");
  } else {
    assertEquals(newline, "\n");
  }
});

Deno.test("normalizeNewlines remplace toutes les fins de ligne", () => {
  const input = "a\rb\nc\r\nd";
  assertEquals(normalizeNewlines(input, "\n"), "a\nb\nc\nd");
  assertEquals(normalizeNewlines(input, "\r\n"), "a\r\nb\r\nc\r\nd");
});
