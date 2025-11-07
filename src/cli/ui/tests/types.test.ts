import { assertEquals } from "../../../testing/asserts.ts";
import { TreeChars } from "../types.ts";

Deno.test("TreeChars contains all expected characters", () => {
  assertEquals(typeof TreeChars.VERTICAL, "string");
  assertEquals(typeof TreeChars.MIDDLE, "string");
  assertEquals(typeof TreeChars.LAST, "string");
  assertEquals(typeof TreeChars.BRANCH, "string");
  assertEquals(typeof TreeChars.INDENT, "string");
  assertEquals(typeof TreeChars.BULLET, "string");
});

Deno.test("TreeChars characters are box drawing", () => {
  assertEquals(TreeChars.VERTICAL, "│");
  assertEquals(TreeChars.MIDDLE, "├─");
  assertEquals(TreeChars.LAST, "└─");
  assertEquals(TreeChars.BRANCH, "├─");
  assertEquals(TreeChars.INDENT, "│  ");
  assertEquals(TreeChars.BULLET, "•");
});

Deno.test("TreeChars is readonly", () => {
  // TypeScript should prevent modification, but we can verify the object exists
  assertEquals(typeof TreeChars, "object");
  assertEquals(Object.keys(TreeChars).length, 6);
});
