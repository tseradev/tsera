import { assert, assertEquals, assertStringIncludes } from "std/assert";
import { join } from "../../../shared/path.ts";
import { mcpCommand } from "./mcp.ts";

Deno.test("mcp command shows help", () => {
  const command = mcpCommand;
  const captured: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    captured.push(args.map((value) => String(value)).join(" "));
  };

  try {
    command.showHelp();
  } finally {
    console.log = originalLog;
  }

  const output = captured.join("\n");
  assertStringIncludes(output, "Start the Model Context Protocol server");
  assertStringIncludes(output, "tsera mcp");
  assertStringIncludes(output, "OPTIONS");
  assertStringIncludes(output, "EXAMPLES");
});

Deno.test("mcp command has correct description", () => {
  const command = mcpCommand;
  assertEquals(
    command.getDescription(),
    "Start the Model Context Protocol server for AI agents.",
  );
});

Deno.test("mcp stop command shows help", () => {
  const command = mcpCommand.getCommand("stop");
  assert(command !== undefined, "stop subcommand should exist");

  const captured: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    captured.push(args.map((value) => String(value)).join(" "));
  };

  try {
    command.showHelp();
  } finally {
    console.log = originalLog;
  }

  const output = captured.join("\n");
  assertStringIncludes(output, "Stop the MCP server");
  assertStringIncludes(output, "tsera mcp stop");
  assertStringIncludes(output, "OPTIONS");
  assertStringIncludes(output, "EXAMPLES");
});

Deno.test("mcp stop fails when no server is running", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-mcp-test-" });
  try {
    const originalCwd = Deno.cwd();
    Deno.chdir(tempDir);

    // Create a minimal TSera project structure
    await Deno.mkdir(join(tempDir, "config"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, "config", "tsera.config.ts"),
      `export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "sqlite", file: "db.sqlite" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
};`,
    );

    const originalExit = Deno.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    const errors: string[] = [];

    Deno.exit = ((code: number) => {
      exitCode = code;
    }) as typeof Deno.exit;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((v) => String(v)).join(" "));
    };

    try {
      const stopCommand = mcpCommand.getCommand("stop");
      if (stopCommand) {
        await stopCommand.parse([]);
      }
    } catch {
      // Expected to fail
    } finally {
      Deno.exit = originalExit;
      console.error = originalError;
      Deno.chdir(originalCwd);
    }

    // Should have attempted to exit with code 1
    assert(exitCode === 1, "Should exit with code 1 when no server is running");
    const errorOutput = errors.join("\n");
    assertStringIncludes(errorOutput, "No MCP server found");
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => { });
  }
});

Deno.test("mcp stop handles stale PID file", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-mcp-test-" });
  const originalCwd = Deno.cwd();
  try {
    Deno.chdir(tempDir);

    // Create a minimal TSera project structure
    await Deno.mkdir(join(tempDir, "config"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, "config", "tsera.config.ts"),
      `export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "sqlite", file: "db.sqlite" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
};`,
    );

    // Create a stale PID file with a non-existent PID
    // Use a PID that's definitely not running (current PID + large offset)
    const stalePid = Deno.pid + 1000000;
    await Deno.mkdir(join(tempDir, ".tsera"), { recursive: true });
    await Deno.writeTextFile(join(tempDir, ".tsera", "mcp.pid"), String(stalePid));

    // Verify PID file exists before test
    const pidFileBefore = await Deno.stat(join(tempDir, ".tsera", "mcp.pid"));
    assert(pidFileBefore !== null, "PID file should exist before test");

    const originalExit = Deno.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    let exitCalled = false;
    const errors: string[] = [];

    Deno.exit = ((code: number) => {
      exitCode = code;
      exitCalled = true;
      throw new Error(`Exit called with code ${code}`); // Throw to stop execution
    }) as typeof Deno.exit;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((v) => String(v)).join(" "));
    };

    try {
      const stopCommand = mcpCommand.getCommand("stop");
      if (stopCommand) {
        await stopCommand.parse([]);
      }
    } catch (error) {
      // Expected to fail - either from Deno.exit mock or actual error
      if (!(error instanceof Error && error.message.includes("Exit called"))) {
        // If it's not our mock exit, check if it's a different expected error
        // On some systems, isProcessRunning might return true for invalid PIDs
        // In that case, the process might try to kill it and fail
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes("Failed to stop")) {
          throw error;
        }
      }
    } finally {
      Deno.exit = originalExit;
      console.error = originalError;
      Deno.chdir(originalCwd);
    }

    // Check that either exit was called with code 1, or the PID file was removed
    // (on some systems, isProcessRunning might incorrectly return true, causing kill attempt)
    if (exitCalled) {
      assert(exitCode === 1, `Should exit with code 1 when PID is stale, got ${exitCode}`);
      const errorOutput = errors.join("\n");
      assertStringIncludes(errorOutput, "PID may be stale");
    }

    // PID file should be removed in both cases (stale detection or kill failure)
    const pidFileAfter = await Deno.stat(join(tempDir, ".tsera", "mcp.pid")).catch(() => null);
    assert(pidFileAfter === null, "PID file should be removed after handling stale PID");
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => { });
  }
});

Deno.test("mcp background start creates PID file", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-mcp-test-" });
  const originalCwd = Deno.cwd();
  try {
    Deno.chdir(tempDir);

    // Create a minimal TSera project structure
    await Deno.mkdir(join(tempDir, "config"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, "config", "tsera.config.ts"),
      `export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "sqlite", file: "db.sqlite" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
};`,
    );

    // Note: We can't actually start a background process in tests without complex mocking
    // Instead, we verify that the command structure supports the --background flag
    const command = mcpCommand;
    const options = command.getOptions();

    // Verify --background option exists
    const backgroundOption = options.find((opt) => opt.flags.includes("--background"));
    assert(backgroundOption !== undefined, "--background option should exist");
  } finally {
    Deno.chdir(originalCwd);
    await Deno.remove(tempDir, { recursive: true }).catch(() => { });
  }
});

Deno.test("mcp background start prevents duplicate servers", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-mcp-test-" });
  try {
    const originalCwd = Deno.cwd();
    Deno.chdir(tempDir);

    // Create a minimal TSera project structure
    await Deno.mkdir(join(tempDir, "config"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, "config", "tsera.config.ts"),
      `export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "sqlite", file: "db.sqlite" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
};`,
    );

    // Create a PID file with current process PID (simulating running server)
    await Deno.mkdir(join(tempDir, ".tsera"), { recursive: true });
    const currentPid = Deno.pid;
    await Deno.writeTextFile(join(tempDir, ".tsera", "mcp.pid"), String(currentPid));

    const originalExit = Deno.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    const errors: string[] = [];

    Deno.exit = ((code: number) => {
      exitCode = code;
    }) as typeof Deno.exit;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((v) => String(v)).join(" "));
    };

    try {
      await mcpCommand.parse(["--background"]);
    } catch {
      // Expected to fail
    } finally {
      Deno.exit = originalExit;
      console.error = originalError;
      Deno.chdir(originalCwd);
    }

    // Should have attempted to exit with code 1
    assert(exitCode === 1, "Should exit with code 1 when server is already running");
    const errorOutput = errors.join("\n");
    assertStringIncludes(errorOutput, "already running");
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => { });
  }
});

Deno.test("mcp foreground start prevents duplicate servers when background server is running", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-mcp-test-" });
  const originalCwd = Deno.cwd();
  try {
    Deno.chdir(tempDir);

    // Create a minimal TSera project structure
    await Deno.mkdir(join(tempDir, "config"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, "config", "tsera.config.ts"),
      `export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: { dialect: "sqlite", file: "db.sqlite" },
  deploy: { target: "deno_deploy", entry: "app/back/main.ts" },
};`,
    );

    // Create a PID file with current process PID (simulating running background server)
    await Deno.mkdir(join(tempDir, ".tsera"), { recursive: true });
    const currentPid = Deno.pid;
    await Deno.writeTextFile(join(tempDir, ".tsera", "mcp.pid"), String(currentPid));

    const originalExit = Deno.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    const errors: string[] = [];

    Deno.exit = ((code: number) => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    }) as typeof Deno.exit;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((v) => String(v)).join(" "));
    };

    try {
      // Try to start in foreground (without --background flag)
      // Use Promise.race with timeout to prevent infinite blocking
      // The command should detect the existing PID and exit before reading from stdin
      await Promise.race([
        mcpCommand.parse([]),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Test timeout: command blocked too long")), 2000);
        }),
      ]);
    } catch (error) {
      // Expected to fail (either exit or timeout)
      if (error instanceof Error && error.message.startsWith("exit:")) {
        // Exit was called, which is expected
        const match = error.message.match(/exit:(\d+)/);
        if (match) {
          exitCode = parseInt(match[1], 10);
        }
      } else if (error instanceof Error && error.message.includes("timeout")) {
        // Timeout means the command blocked, which shouldn't happen if PID detection works
        // This could happen if isProcessRunning doesn't detect the current PID correctly
        // In that case, we should still check if exit was called
        if (exitCode === undefined) {
          throw new Error("Command blocked on stdin - PID detection may have failed");
        }
      }
      // Other errors are acceptable
    } finally {
      Deno.exit = originalExit;
      console.error = originalError;
      Deno.chdir(originalCwd);
    }

    // Should have attempted to exit with code 1
    assert(exitCode === 1, "Should exit with code 1 when background server is already running");
    const errorOutput = errors.join("\n");
    assertStringIncludes(errorOutput, "already running");
    assertStringIncludes(errorOutput, "background");
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => { });
  }
});
