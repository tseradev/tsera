import { assertEquals, assertStringIncludes } from "std/assert";
import { exportEnvCommand } from "./export-env.ts";

Deno.test("export-env command shows help", () => {
  const captured: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    captured.push(args.map((value) => String(value)).join(" "));
  };

  try {
    exportEnvCommand.showHelp();
  } finally {
    console.log = originalLog;
  }

  const output = captured.join("\n");
  assertStringIncludes(
    output,
    "Export environment variables for runtime or CI",
  );
  assertStringIncludes(output, "--env");
  assertStringIncludes(output, "--format");
  assertStringIncludes(output, "--prefix");
  assertStringIncludes(output, "--out");
});

Deno.test("export-env command has correct name", () => {
  assertEquals(exportEnvCommand.getName(), "export-env");
});

Deno.test("export-env command has correct description", () => {
  assertEquals(
    exportEnvCommand.getDescription(),
    "Export environment variables for runtime or CI",
  );
});

Deno.test("loadSchema returns null when file not found", async () => {
  const { loadSchema } = await import("./export-env.ts");

  // Mock Deno.cwd to return a non-existent directory
  const originalCwd = Deno.cwd;
  Deno.cwd = () => "/non/existent/path";

  try {
    const result = await loadSchema();
    assertEquals(result, null);
  } finally {
    Deno.cwd = originalCwd;
  }
});
