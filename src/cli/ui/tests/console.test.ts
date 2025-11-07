/**
 * Tests for the BaseConsole component.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "../../../testing/asserts.ts";
import { BaseConsole } from "../console.ts";

/**
 * Helper to capture console output.
 */
function createTestConsole(): { console: BaseConsole; output: string[] } {
  const output: string[] = [];
  const console = new BaseConsole((line) => output.push(line));
  return { console, output };
}

Deno.test("BaseConsole - writes plain text", () => {
  const { console, output } = createTestConsole();

  console["write"]("Hello, world!");

  assertEquals(output.length, 1);
  assertEquals(output[0], "Hello, world!");
});

Deno.test("BaseConsole - writes middle tree branch", () => {
  const { console, output } = createTestConsole();

  console["writeMiddle"]("First item");

  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "├─");
  assertStringIncludes(output[0], "First item");
});

Deno.test("BaseConsole - writes last tree branch", () => {
  const { console, output } = createTestConsole();

  console["writeLast"]("Final item");

  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "└─");
  assertStringIncludes(output[0], "Final item");
});

Deno.test("BaseConsole - writes sub-items with indentation", () => {
  const { console, output } = createTestConsole();

  console["writeSubItem"]("Indented content");

  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "│");
  assertStringIncludes(output[0], "Indented content");
});

Deno.test("BaseConsole - writes bulleted items", () => {
  const { console, output } = createTestConsole();

  console["writeBullet"]("Bullet point");

  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "•");
  assertStringIncludes(output[0], "Bullet point");
});

Deno.test("BaseConsole - writes bulleted items with custom prefix", () => {
  const { console, output } = createTestConsole();

  console["writeBullet"]("Custom point", "→");

  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "→");
  assertStringIncludes(output[0], "Custom point");
});

Deno.test("BaseConsole - creates tree structure", () => {
  const { console, output } = createTestConsole();

  console["write"]("Root");
  console["writeMiddle"]("Item 1");
  console["writeSubItem"]("Detail 1");
  console["writeMiddle"]("Item 2");
  console["writeLast"]("Item 3");

  assertEquals(output.length, 5);
  assertEquals(output[0], "Root");
  assertStringIncludes(output[1], "├─");
  assertStringIncludes(output[2], "│");
  assertStringIncludes(output[3], "├─");
  assertStringIncludes(output[4], "└─");
});

Deno.test("BaseConsole - can be extended", () => {
  class CustomConsole extends BaseConsole {
    showReport() {
      this.write("Report:");
      this.writeMiddle("Status: OK");
      this.writeLast("Complete");
    }
  }

  const output: string[] = [];
  const custom = new CustomConsole((line) => output.push(line));
  custom.showReport();

  assertEquals(output.length, 3);
  assertStringIncludes(output[0], "Report:");
  assertStringIncludes(output[1], "Status: OK");
  assertStringIncludes(output[2], "Complete");
});
