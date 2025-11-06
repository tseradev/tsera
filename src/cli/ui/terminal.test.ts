import { assertEquals } from "../../testing/asserts.ts";
import { clampWidth, detectTerminalWidth } from "./terminal.ts";

Deno.test("clampWidth constrains values within bounds", () => {
  assertEquals(clampWidth(100), 100);
  assertEquals(clampWidth(40), 60); // Below min (60)
  assertEquals(clampWidth(200), 120); // Above max (120)
  assertEquals(clampWidth(80), 80); // Within range
});

Deno.test("clampWidth handles edge cases", () => {
  assertEquals(clampWidth(60), 60); // Exactly min
  assertEquals(clampWidth(120), 120); // Exactly max
  assertEquals(clampWidth(0), 60); // Zero becomes min
  assertEquals(clampWidth(-10), 60); // Negative becomes min
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
