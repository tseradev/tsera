import { assertEquals } from "std/assert";
import { StringBuilder, visualWidth, wrapText } from "../text-utils.ts";

Deno.test("visualWidth counts visible characters", () => {
  assertEquals(visualWidth("hello"), 5);
  assertEquals(visualWidth(""), 0);
  assertEquals(visualWidth("test string"), 11);
});

Deno.test("visualWidth ignores ANSI codes", () => {
  const colored = "\x1b[31mRed\x1b[0m";
  assertEquals(visualWidth(colored), 3); // Only "Red" is visible
});

Deno.test("wrapText splits long text", () => {
  const text = "This is a long line that should be wrapped";
  const wrapped = wrapText(text, 20);

  assertEquals(wrapped.length > 1, true);
  for (const line of wrapped) {
    assertEquals(line.length <= 20, true);
  }
});

Deno.test("wrapText preserves short text", () => {
  const text = "Short";
  const wrapped = wrapText(text, 20);

  assertEquals(wrapped.length, 1);
  assertEquals(wrapped[0], "Short");
});

Deno.test("wrapText handles empty text", () => {
  const wrapped = wrapText("", 20);
  assertEquals(wrapped.length, 0);
});

Deno.test("StringBuilder builds strings", () => {
  const builder = new StringBuilder();

  builder.append("Hello");
  builder.append(" ");
  builder.append("World");

  assertEquals(builder.toString(), "Hello World");
});

Deno.test("StringBuilder handles empty", () => {
  const builder = new StringBuilder();
  assertEquals(builder.toString(), "");
});

Deno.test("StringBuilder chains appends", () => {
  const builder = new StringBuilder();
  const result = builder.append("A").append("B").append("C").toString();
  assertEquals(result, "ABC");
});
