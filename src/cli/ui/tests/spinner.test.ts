/**
 * Tests for the TerminalSpinner component.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "../../../testing/asserts.ts";
import { TerminalSpinner } from "../spinner.ts";

/**
 * Helper to capture output from a spinner instance.
 */
function createTestSpinner(): { spinner: TerminalSpinner; output: string[] } {
  const output: string[] = [];
  const spinner = new TerminalSpinner((line) => output.push(line));
  return { spinner, output };
}

Deno.test("TerminalSpinner - starts with initial text", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Loading...");

  // In non-TTY environment (test), should output simple message
  assertEquals(output.length, 1);
  assertStringIncludes(output[0], "Loading...");
});

Deno.test("TerminalSpinner - updates with new text", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Step 1");
  spinner.update("Step 2");

  // Should have two outputs (start and update)
  assertEquals(output.length, 2);
  assertStringIncludes(output[0], "Step 1");
  assertStringIncludes(output[1], "Step 2");
});

Deno.test("TerminalSpinner - succeeds with green checkmark", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Processing...");
  spinner.succeed("Done!");

  assertEquals(output.length, 2);
  assertStringIncludes(output[1], "Done!");
  // Note: In non-colored output, checkmark symbol is still present
  assertStringIncludes(output[1], "✔");
});

Deno.test("TerminalSpinner - warns with yellow symbol", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Checking...");
  spinner.warn("Issues found");

  assertEquals(output.length, 2);
  assertStringIncludes(output[1], "Issues found");
  assertStringIncludes(output[1], "⚠");
});

Deno.test("TerminalSpinner - fails with magenta X", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Attempting...");
  spinner.fail("Failed");

  assertEquals(output.length, 2);
  assertStringIncludes(output[1], "Failed");
  assertStringIncludes(output[1], "✖");
});

Deno.test("TerminalSpinner - stop without completion message", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Running...");
  spinner.stop();

  // Only start message, no completion
  assertEquals(output.length, 1);
});

Deno.test("TerminalSpinner - skips duplicate updates", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Message");
  spinner.update("Message"); // Same text
  spinner.update("New Message");

  // First message, skipped duplicate, then new message
  assertEquals(output.length, 2);
  assertStringIncludes(output[0], "Message");
  assertStringIncludes(output[1], "New Message");
});

Deno.test("TerminalSpinner - multiple operations in sequence", () => {
  const { spinner, output } = createTestSpinner();

  spinner.start("Operation 1");
  spinner.succeed("Operation 1 complete");

  // Output should contain both messages
  assertEquals(output.length, 2);
  assertStringIncludes(output[0], "Operation 1");
  assertStringIncludes(output[1], "Operation 1 complete");
});
