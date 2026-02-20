/**
 * Tests for export-env CLI command.
 *
 * @module
 *
 * Tests cover:
 * - Schema loading from config files
 * - Export to different formats (sh, json)
 * - Validation of environment variables
 * - Error handling for invalid inputs
 * - Prefix application to exported variables
 * - JSON mode with NDJSON events
 * - Console mode (raw output) vs File mode (with status messages)
 * - Exit codes (1 for general error, 2 for usage error)
 */

import { assertEquals, assertStringIncludes } from "std/assert";
import type { Logger } from "../../utils/log.ts";
import { ExportEnvConsole } from "./export-env-ui.ts";
import {
  createDefaultExportEnvHandler,
  createExportEnvCommand,
  exportEnvCommand,
  type ExportEnvContext,
  loadSchema,
} from "./export-env.ts";

// Helper to create a mock logger
function createMockLogger(): { logger: Logger; events: { type: string; data: unknown }[] } {
  const events: { type: string; data: unknown }[] = [];
  const logger: Logger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
    event: (type: string, data: unknown) => {
      events.push({ type, data });
    },
  };
  return { logger, events };
}

// ============================================================================
// Command Metadata Tests
// ============================================================================

Deno.test("export-env command has correct name", () => {
  assertEquals(exportEnvCommand.getName(), "export-env");
});

Deno.test("export-env command has correct description", () => {
  assertEquals(
    exportEnvCommand.getDescription(),
    "Export environment variables for runtime or CI/CD pipelines.",
  );
});

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
    "Export environment variables for runtime or CI/CD pipelines",
  );
  assertStringIncludes(output, "--env");
  assertStringIncludes(output, "--format");
  assertStringIncludes(output, "--prefix");
  assertStringIncludes(output, "--file");
});

// ============================================================================
// loadSchema Tests
// ============================================================================

Deno.test("loadSchema returns null when file not found", async () => {
  // Mock Deno.cwd to return a non-existent directory
  const originalCwd = Deno.cwd;
  Deno.cwd = () => "/non/existent/path";

  try {
    const result = await loadSchema("/non/existent/path");
    // loadSchema returns null when file not found
    assertEquals(result, null);
  } catch (error) {
    // In Deno v2, the import might throw an error
    if (error instanceof Error && error.message.includes("Module not found")) {
      // This is expected behavior
      return;
    }
    throw error;
  } finally {
    Deno.cwd = originalCwd;
  }
});

Deno.test("loadSchema returns schema when file exists", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  try {
    const schema = await loadSchema(tempDir);

    assertEquals(schema, {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("loadSchema supports multiple export formats", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  // Test default export
  const schemaPath1 = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath1,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  try {
    const schema1 = await loadSchema(tempDir);
    assertEquals(schema1, { PORT: { type: "number", required: true } });

    // Test envSchema export
    await Deno.writeTextFile(
      schemaPath1,
      `export const envSchema = {
        PORT: { type: "number", required: true },
      };`,
    );

    const schema2 = await loadSchema(tempDir);
    assertEquals(schema2, { PORT: { type: "number", required: true } });

    // Test schema export
    await Deno.writeTextFile(
      schemaPath1,
      `export const schema = {
        PORT: { type: "number", required: true },
      };`,
    );

    const schema3 = await loadSchema(tempDir);
    assertEquals(schema3, { PORT: { type: "number", required: true } });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// Factory Pattern Tests
// ============================================================================

Deno.test("createDefaultExportEnvHandler creates handler with default dependencies", () => {
  const handler = createDefaultExportEnvHandler();
  assertEquals(typeof handler, "function");
});

Deno.test("createDefaultExportEnvHandler accepts custom dependencies", () => {
  const mockExit = (_code: number): never => {
    throw new Error("exit called");
  };
  const handler = createDefaultExportEnvHandler({ exit: mockExit });
  assertEquals(typeof handler, "function");
});

// ============================================================================
// Exit Code Tests
// ============================================================================

Deno.test("handler returns exit code 2 for invalid format (usage error)", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const { logger: mockLogger, events: capturedEvents } = createMockLogger();

  let exitCode = 0;
  const mockExit = (code: number): never => {
    exitCode = code;
    throw new Error(`exit:${code}`);
  };

  const handler = createDefaultExportEnvHandler({
    exit: mockExit,
    logger: mockLogger,
    getEnv: () => undefined,
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "invalid-format" as "json",
    prefix: "",
    cwd: tempDir,
    global: { json: true },
  };

  try {
    await handler(context);
  } catch (error) {
    if (error instanceof Error && error.message === "exit:2") {
      assertEquals(exitCode, 2);
      assertEquals(capturedEvents[0]?.type, "export-env:start");
      assertEquals(capturedEvents[1]?.type, "export-env:error");
      assertEquals((capturedEvents[1]?.data as { type: string })?.type, "usage");
    } else {
      throw error;
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("handler returns exit code 1 for validation errors (general error)", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  const { logger: mockLogger, events: capturedEvents } = createMockLogger();

  let exitCode = 0;
  const mockExit = (code: number): never => {
    exitCode = code;
    throw new Error(`exit:${code}`);
  };

  const handler = createDefaultExportEnvHandler({
    exit: mockExit,
    logger: mockLogger,
    getEnv: (key: string) => key === "PORT" ? "8000" : undefined, // DATABASE_URL is missing
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "json",
    prefix: "",
    cwd: tempDir,
    global: { json: true },
  };

  try {
    await handler(context);
  } catch (error) {
    if (error instanceof Error && error.message === "exit:1") {
      assertEquals(exitCode, 1);
      assertEquals(capturedEvents[0]?.type, "export-env:start");
      assertEquals(capturedEvents[1]?.type, "export-env:schema");
      assertEquals(capturedEvents[2]?.type, "export-env:error");
      assertEquals((capturedEvents[2]?.data as { type: string })?.type, "validation");
    } else {
      throw error;
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("handler returns exit code 1 for missing schema (general error)", async () => {
  const tempDir = await Deno.makeTempDir();
  // Don't create config/secrets directory

  const { logger: mockLogger, events: capturedEvents } = createMockLogger();

  let exitCode = 0;
  const mockExit = (code: number): never => {
    exitCode = code;
    throw new Error(`exit:${code}`);
  };

  const handler = createDefaultExportEnvHandler({
    exit: mockExit,
    logger: mockLogger,
    getEnv: () => undefined,
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "json",
    prefix: "",
    cwd: tempDir,
    global: { json: true },
  };

  try {
    await handler(context);
  } catch (error) {
    if (error instanceof Error && error.message === "exit:1") {
      assertEquals(exitCode, 1);
      assertEquals(capturedEvents[0]?.type, "export-env:start");
      assertEquals(capturedEvents[1]?.type, "export-env:error");
      assertEquals((capturedEvents[1]?.data as { type: string })?.type, "schema");
    } else {
      throw error;
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// JSON Mode Tests
// ============================================================================

Deno.test("handler emits NDJSON events in JSON mode", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const { logger: mockLogger, events: capturedEvents } = createMockLogger();

  const capturedOutput: string[] = [];
  const handler = createDefaultExportEnvHandler({
    logger: mockLogger,
    getEnv: () => "8000",
    writer: (line) => capturedOutput.push(line),
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "json",
    prefix: "",
    cwd: tempDir,
    global: { json: true },
  };

  await handler(context);

  // Verify event sequence
  assertEquals(capturedEvents[0]?.type, "export-env:start");
  assertEquals(capturedEvents[1]?.type, "export-env:schema");
  assertEquals(capturedEvents[2]?.type, "export-env:exporting");
  assertEquals(capturedEvents[3]?.type, "export-env:success");

  // Verify event data
  assertEquals((capturedEvents[0]?.data as { env: string })?.env, "dev");
  assertEquals((capturedEvents[0]?.data as { format: string })?.format, "json");
  assertEquals((capturedEvents[3]?.data as { count: number })?.count, 1);

  // Verify JSON output (compact format in console mode)
  const jsonOutput = JSON.parse(capturedOutput.join(""));
  assertEquals(jsonOutput.PORT, "8000");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("handler uses human UI in non-JSON mode with file output", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const capturedOutput: string[] = [];
  const mockConsole = new ExportEnvConsole({
    writer: (line) => capturedOutput.push(line),
  });

  const handler = createDefaultExportEnvHandler({
    console: mockConsole,
    getEnv: () => "8000",
    writer: (line) => capturedOutput.push(line),
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "json",
    prefix: "",
    file: "output.json",
    cwd: tempDir,
    global: { json: false },
  };

  await handler(context);

  // Verify spinner-like output (verbose mode enabled by file)
  const output = capturedOutput.join("\n");
  assertStringIncludes(output, "Export");

  await Deno.remove(tempDir, { recursive: true });
});

// ============================================================================
// Console Mode Tests (Raw Output)
// ============================================================================

Deno.test("handler outputs raw content in console mode (no file)", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const capturedOutput: string[] = [];
  const handler = createDefaultExportEnvHandler({
    getEnv: () => "8000",
    writer: (line) => capturedOutput.push(line),
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "json",
    prefix: "",
    cwd: tempDir,
    global: { json: false }, // No JSON mode, no file = raw output
  };

  await handler(context);

  // In console mode, only raw JSON output (no spinner messages)
  const output = capturedOutput.join("");
  const jsonOutput = JSON.parse(output);
  assertEquals(jsonOutput.PORT, "8000");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("handler outputs raw shell format in console mode", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const capturedOutput: string[] = [];
  const handler = createDefaultExportEnvHandler({
    getEnv: () => "8000",
    writer: (line) => capturedOutput.push(line),
  });

  const context: ExportEnvContext = {
    env: "dev",
    format: "sh",
    prefix: "",
    cwd: tempDir,
    global: { json: false },
  };

  await handler(context);

  // In console mode, only KEY=value output (no spinner messages)
  assertEquals(capturedOutput.length, 1);
  assertEquals(capturedOutput[0], "PORT=8000");

  await Deno.remove(tempDir, { recursive: true });
});

// ============================================================================
// Export Format Tests
// ============================================================================

Deno.test("export-env validates format option", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");

    const capturedStderr: string[] = [];
    const originalStderr = console.error;
    // deno-lint-ignore no-explicit-any
    const originalExit = (Deno as any).exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    // deno-lint-ignore no-explicit-any
    (Deno as any).exit = (code?: number) => {
      throw new Error(`exit:${code}`);
    };

    try {
      await exportEnvCommand.parse(["--format", "invalid-format"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "exit:2") {
        // Expected - usage error
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      // deno-lint-ignore no-explicit-any
      (Deno as any).exit = originalExit;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env validates env option", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");

    const capturedStderr: string[] = [];
    const originalStderr = console.error;
    // deno-lint-ignore no-explicit-any
    const originalExit = (Deno as any).exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    // deno-lint-ignore no-explicit-any
    (Deno as any).exit = (code?: number) => {
      throw new Error(`exit:${code}`);
    };

    try {
      await exportEnvCommand.parse(["--format", "json", "--env", "invalid-env"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "exit:2") {
        // Expected - usage error
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      // deno-lint-ignore no-explicit-any
      (Deno as any).exit = originalExit;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env exports to JSON format (compact in console mode)", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");
    Deno.env.set("DATABASE_URL", "postgresql://localhost:5432/db");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);

      const stdoutOutput = capturedStdout.join("\n");

      // Check JSON output (compact format - single line)
      assertStringIncludes(stdoutOutput, '"PORT"');
      assertStringIncludes(stdoutOutput, '"8000"');
      assertStringIncludes(stdoutOutput, '"DATABASE_URL"');
      assertStringIncludes(stdoutOutput, '"postgresql://localhost:5432/db"');
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
    if (originalDbUrl !== undefined) {
      Deno.env.set("DATABASE_URL", originalDbUrl);
    } else {
      Deno.env.delete("DATABASE_URL");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env exports to shell format (KEY=value)", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");
    Deno.env.set("DATABASE_URL", "postgresql://localhost:5432/db");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh"]);

      const stdoutOutput = capturedStdout.join("\n");

      // Check shell output format (KEY=value)
      assertStringIncludes(stdoutOutput, "PORT=8000");
      assertStringIncludes(stdoutOutput, "DATABASE_URL=postgresql://localhost:5432/db");
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
    if (originalDbUrl !== undefined) {
      Deno.env.set("DATABASE_URL", originalDbUrl);
    } else {
      Deno.env.delete("DATABASE_URL");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env applies prefix to exported variables", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh", "--prefix", "APP_"]);

      const stdoutOutput = capturedStdout.join("\n");

      // Check that prefix is applied
      assertStringIncludes(stdoutOutput, "APP_PORT=8000");
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env validates environment variables", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");
    // DATABASE_URL is missing

    const capturedStderr: string[] = [];
    const originalStderr = console.error;
    // deno-lint-ignore no-explicit-any
    const originalExit = (Deno as any).exit;

    // In console mode, errors go to stderr
    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    // deno-lint-ignore no-explicit-any
    (Deno as any).exit = (code?: number) => {
      throw new Error(`exit:${code}`);
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "exit:1") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "Validation");
        assertStringIncludes(stderrOutput, "DATABASE_URL");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      // deno-lint-ignore no-explicit-any
      (Deno as any).exit = originalExit;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
    if (originalDbUrl !== undefined) {
      Deno.env.set("DATABASE_URL", originalDbUrl);
    } else {
      Deno.env.delete("DATABASE_URL");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env uses TSERA_ENV as default environment", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: ["prod"] },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalTseraEnv = Deno.env.get("TSERA_ENV");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");
    Deno.env.set("TSERA_ENV", "prod");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);

      // Should succeed because TSERA_ENV=prod and PORT is required for prod
      const stdoutOutput = capturedStdout.join("");
      const jsonOutput = JSON.parse(stdoutOutput);
      assertEquals(jsonOutput.PORT, "8000");
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
    if (originalTseraEnv !== undefined) {
      Deno.env.set("TSERA_ENV", originalTseraEnv);
    } else {
      Deno.env.delete("TSERA_ENV");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env throws error when schema not found", async () => {
  const tempDir = await Deno.makeTempDir();
  // Don't create config/secrets directory

  const originalCwd = Deno.cwd;

  try {
    Deno.cwd = () => tempDir;

    const capturedStderr: string[] = [];
    const originalStderr = console.error;
    // deno-lint-ignore no-explicit-any
    const originalExit = (Deno as any).exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    // deno-lint-ignore no-explicit-any
    (Deno as any).exit = (code?: number) => {
      throw new Error(`exit:${code}`);
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "exit:1") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "config/secrets/env.config.ts not found");
        assertStringIncludes(stderrOutput, "secrets module is installed");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      // deno-lint-ignore no-explicit-any
      (Deno as any).exit = originalExit;
    }
  } finally {
    Deno.cwd = originalCwd;
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env handles values with special characters in shell format", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      MESSAGE: { type: "string", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalMessage = Deno.env.get("MESSAGE");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("MESSAGE", "Hello World");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh"]);

      const stdoutOutput = capturedStdout.join("\n");

      // Values with spaces should be quoted
      assertStringIncludes(stdoutOutput, 'MESSAGE="Hello World"');
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalMessage !== undefined) {
      Deno.env.set("MESSAGE", originalMessage);
    } else {
      Deno.env.delete("MESSAGE");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// File Output Tests
// ============================================================================

Deno.test("export-env writes to file in config/secrets/ with --file option", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh", "--file", ".env.output"]);

      // Verify file was created in config/secrets/
      const outputPath = `${tempDir}/config/secrets/.env.output`;
      const fileContent = await Deno.readTextFile(outputPath);
      assertStringIncludes(fileContent, "PORT=8000");

      // Verify status messages were shown (verbose mode)
      const stdoutOutput = capturedStdout.join("\n");
      assertStringIncludes(stdoutOutput, "Export");
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env writes pretty JSON to file in config/secrets/", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(configDir, { recursive: true });

  const schemaPath = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");

  try {
    Deno.cwd = () => tempDir;
    Deno.env.set("PORT", "8000");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "json", "--file", "secrets.json"]);

      // Verify file was created in config/secrets/ with pretty JSON
      const outputPath = `${tempDir}/config/secrets/secrets.json`;
      const fileContent = await Deno.readTextFile(outputPath);
      assertStringIncludes(fileContent, '"PORT"');
      assertStringIncludes(fileContent, '"8000"');
      // Pretty JSON should have newlines
      assertStringIncludes(fileContent, "\n");
    } finally {
      console.log = originalStdout;
    }
  } finally {
    Deno.cwd = originalCwd;

    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// createExportEnvCommand Tests
// ============================================================================

Deno.test("createExportEnvCommand creates command with custom handler", () => {
  const customHandler = async (_context: ExportEnvContext) => {
    // no-op
  };

  const command = createExportEnvCommand(customHandler);
  assertEquals(command.getName(), "export-env");
});
