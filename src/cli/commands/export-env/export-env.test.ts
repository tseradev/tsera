/**
 * Tests for export-env CLI command.
 *
 * @module
 *
 * Tests cover:
 * - Schema loading from config files
 * - Export to different formats (github-env, sh, gitlab-dotenv, json)
 * - Validation of environment variables
 * - Error handling for invalid inputs
 * - Prefix application to exported variables
 */

import { assertEquals, assertStringIncludes } from "std/assert";
import { exportEnvCommand, loadSchema } from "./export-env.ts";

// ============================================================================
// Command Metadata Tests
// ============================================================================

Deno.test("export-env command has correct name", () => {
  assertEquals(exportEnvCommand.getName(), "export-env");
});

Deno.test("export-env command has correct description", () => {
  assertEquals(
    exportEnvCommand.getDescription(),
    "Export environment variables for runtime or CI",
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
    "Export environment variables for runtime or CI",
  );
  assertStringIncludes(output, "--env");
  assertStringIncludes(output, "--format");
  assertStringIncludes(output, "--prefix");
  assertStringIncludes(output, "--out");
});

// ============================================================================
// loadSchema Tests
// ============================================================================

Deno.test("loadSchema returns null when file not found", async () => {
  // Mock Deno.cwd to return a non-existent directory
  const originalCwd = Deno.cwd;
  Deno.cwd = () => "/non/existent/path";

  try {
    const result = await loadSchema();
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
  const configDir = `${tempDir}/config/secret`;
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

  try {
    Deno.cwd = () => tempDir;

    const schema = await loadSchema();

    assertEquals(schema, {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    });
  } finally {
    Deno.cwd = originalCwd;
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("loadSchema supports multiple export formats", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
  await Deno.mkdir(configDir, { recursive: true });

  // Test default export
  const schemaPath1 = `${configDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath1,
    `export default {
      PORT: { type: "number", required: true },
    };`,
  );

  const originalCwd = Deno.cwd;

  try {
    Deno.cwd = () => tempDir;

    const schema1 = await loadSchema();
    assertEquals(schema1, { PORT: { type: "number", required: true } });

    // Test envSchema export
    await Deno.writeTextFile(
      schemaPath1,
      `export const envSchema = {
        PORT: { type: "number", required: true },
      };`,
    );

    const schema2 = await loadSchema();
    assertEquals(schema2, { PORT: { type: "number", required: true } });

    // Test schema export
    await Deno.writeTextFile(
      schemaPath1,
      `export const schema = {
        PORT: { type: "number", required: true },
      };`,
    );

    const schema3 = await loadSchema();
    assertEquals(schema3, { PORT: { type: "number", required: true } });
  } finally {
    Deno.cwd = originalCwd;
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// Export Format Tests
// ============================================================================

Deno.test("export-env validates format option", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
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
    const originalExit = Deno.exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    Deno.exit = () => {
      throw new Error("Deno.exit called");
    };

    try {
      await exportEnvCommand.parse(["--format", "invalid-format"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "Deno.exit called") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "invalid format");
        assertStringIncludes(stderrOutput, "github-env, sh, gitlab-dotenv, json");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      Deno.exit = originalExit;
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
  const configDir = `${tempDir}/config/secret`;
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
    const originalExit = Deno.exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    Deno.exit = () => {
      throw new Error("Deno.exit called");
    };

    try {
      await exportEnvCommand.parse(["--format", "json", "--env", "invalid-env"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "Deno.exit called") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "invalid environment");
        assertStringIncludes(stderrOutput, "dev, staging, prod");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      Deno.exit = originalExit;
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

Deno.test("export-env requires --out for gitlab-dotenv format", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
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
    const originalExit = Deno.exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    Deno.exit = () => {
      throw new Error("Deno.exit called");
    };

    try {
      await exportEnvCommand.parse(["--format", "gitlab-dotenv"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "Deno.exit called") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "--out option is required");
        assertStringIncludes(stderrOutput, "gitlab-dotenv");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      Deno.exit = originalExit;
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

Deno.test("export-env exports to JSON format", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
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
    const capturedStderr: string[] = [];
    const originalStdout = console.log;
    const originalStderr = console.error;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };
    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);

      const stdoutOutput = capturedStdout.join("\n");
      const stderrOutput = capturedStderr.join("\n");

      // Check JSON output
      assertStringIncludes(stdoutOutput, '"PORT"');
      assertStringIncludes(stdoutOutput, '"8000"');
      assertStringIncludes(stdoutOutput, '"DATABASE_URL"');
      assertStringIncludes(stdoutOutput, '"postgresql://localhost:5432/db"');

      // Check success message
      assertStringIncludes(stderrOutput, "Export successful");
      assertStringIncludes(stderrOutput, "2 variable(s)");
      assertStringIncludes(stderrOutput, "json format");
    } finally {
      console.log = originalStdout;
      console.error = originalStderr;
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

Deno.test("export-env exports to shell format", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
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
    const capturedStderr: string[] = [];
    const originalStdout = console.log;
    const originalStderr = console.error;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };
    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh"]);

      const stdoutOutput = capturedStdout.join("\n");
      const stderrOutput = capturedStderr.join("\n");

      // Check shell export output
      assertStringIncludes(stdoutOutput, "export PORT='8000'");
      assertStringIncludes(stdoutOutput, "export DATABASE_URL='postgresql://localhost:5432/db'");

      // Check success message
      assertStringIncludes(stderrOutput, "Export successful");
      assertStringIncludes(stderrOutput, "2 variable(s)");
      assertStringIncludes(stderrOutput, "sh format");
    } finally {
      console.log = originalStdout;
      console.error = originalStderr;
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
  const configDir = `${tempDir}/config/secret`;
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
      assertStringIncludes(stdoutOutput, "export APP_PORT='8000'");
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
  const configDir = `${tempDir}/config/secret`;
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
    const originalExit = Deno.exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    Deno.exit = () => {
      throw new Error("Deno.exit called");
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "Deno.exit called") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "Validation errors");
        assertStringIncludes(stderrOutput, "Missing required var");
        assertStringIncludes(stderrOutput, "DATABASE_URL");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      Deno.exit = originalExit;
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
  const configDir = `${tempDir}/config/secret`;
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

    const capturedStderr: string[] = [];
    const originalStderr = console.error;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);

      const stderrOutput = capturedStderr.join("\n");

      // Should succeed because TSERA_ENV=prod and PORT is required for prod
      assertStringIncludes(stderrOutput, "Export successful");
    } finally {
      console.error = originalStderr;
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
  // Don't create config/secret directory

  const originalCwd = Deno.cwd;

  try {
    Deno.cwd = () => tempDir;

    const capturedStderr: string[] = [];
    const originalStderr = console.error;
    const originalExit = Deno.exit;

    console.error = (...args: unknown[]) => {
      capturedStderr.push(args.map((value) => String(value)).join(" "));
    };
    Deno.exit = () => {
      throw new Error("Deno.exit called");
    };

    try {
      await exportEnvCommand.parse(["--format", "json"]);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error && error.message === "Deno.exit called") {
        const stderrOutput = capturedStderr.join("\n");
        assertStringIncludes(stderrOutput, "config/secret/env.config.ts not found");
        assertStringIncludes(stderrOutput, "secrets module is installed");
      } else {
        throw error;
      }
    } finally {
      console.error = originalStderr;
      Deno.exit = originalExit;
    }
  } catch (error) {
    // In Deno v2, the import might throw an error before CLI execution
    if (error instanceof Error && error.message.includes("Module not found")) {
      // This is expected behavior
      return;
    }
    throw error;
  } finally {
    Deno.cwd = originalCwd;
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("export-env handles values with special characters in shell format", async () => {
  const tempDir = await Deno.makeTempDir();
  const configDir = `${tempDir}/config/secret`;
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
    Deno.env.set("MESSAGE", "Hello's World");

    const capturedStdout: string[] = [];
    const originalStdout = console.log;

    console.log = (...args: unknown[]) => {
      capturedStdout.push(args.map((value) => String(value)).join(" "));
    };

    try {
      await exportEnvCommand.parse(["--format", "sh"]);

      const stdoutOutput = capturedStdout.join("\n");

      // Check that single quotes are properly escaped
      assertStringIncludes(stdoutOutput, "export MESSAGE='Hello'\\''s World'");
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
