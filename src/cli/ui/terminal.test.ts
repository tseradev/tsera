import { assertEquals } from "../../testing/asserts.ts";
import { clampWidth, detectTerminalWidth } from "./terminal.ts";

Deno.test("clampWidth constrains values within bounds", () => {
  assertEquals(clampWidth(100), 100);
  assertEquals(clampWidth(40), 64); // Below min (64)
  assertEquals(clampWidth(200), 100); // Above max (100)
  assertEquals(clampWidth(80), 80); // Within range
});

Deno.test("clampWidth handles edge cases", () => {
  assertEquals(clampWidth(64), 64); // Exactly min
  assertEquals(clampWidth(100), 100); // Exactly max
  assertEquals(clampWidth(0), 84); // Zero becomes default
  assertEquals(clampWidth(-10), 84); // Negative becomes default
});

Deno.test("detectTerminalWidth returns number or undefined", () => {
  const width = detectTerminalWidth();
  if (width !== undefined) {
    assertEquals(typeof width, "number");
    assertEquals(width > 0, true);
  } else {
    // In non-TTY environments, undefined is acceptable
    assertEquals(width, undefined);
  }
});
