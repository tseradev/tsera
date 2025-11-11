import { assertEquals } from "std/assert";
import { applyModernHelp, createHelpCommand } from "./help.ts";

Deno.test("createHelpCommand returns a Command instance", () => {
  const command = createHelpCommand();
  assertEquals(typeof command, "object");
  assertEquals(typeof command.parse, "function");
});

Deno.test("applyModernHelp patches showHelp method", () => {
  let originalCalled = false;

  const mockCommand = {
    showHelp: () => {
      originalCalled = true;
    },
  };

  const config = {
    cliName: "test",
    version: "0.0.0",
    tagline: "Test CLI",
    usage: "<command> [options]",
    commands: [],
    globalOptions: [],
    examples: [],
  };

  applyModernHelp(mockCommand, config);

  // After patching, the custom help should be called
  mockCommand.showHelp();

  // Original should not be called in normal circumstances
  assertEquals(originalCalled, false);
  // We can't easily test if custom was called without mocking console.log
  // but we can verify the function was replaced
  assertEquals(typeof mockCommand.showHelp, "function");
});
