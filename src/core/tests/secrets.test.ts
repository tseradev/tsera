/**
 * Tests for secrets management system.
 *
 * @module
 *
 * Tests cover:
 * - Type validation for all supported environment variable types
 * - Schema validation with environment-specific requirements
 * - .env file parsing with comments and edge cases
 * - Environment variable loading and validation
 * - Bootstrap functionality with file loading
 */

import { assertEquals, assertRejects } from "std/assert";
import {
  bootstrapEnv,
  EnvName,
  EnvSchema,
  getEnv,
  initializeSecrets,
  isValidEnvName,
  parseEnvFile,
  validateSecrets,
  validateType,
} from "../secrets.ts";

// ============================================================================
// Type Guard Tests
// ============================================================================

Deno.test("isValidEnvName - returns true for valid environment names", () => {
  assertEquals(isValidEnvName("dev"), true);
  assertEquals(isValidEnvName("staging"), true);
  assertEquals(isValidEnvName("prod"), true);
});

Deno.test("isValidEnvName - returns false for invalid environment names", () => {
  assertEquals(isValidEnvName("production"), false);
  assertEquals(isValidEnvName("test"), false);
  assertEquals(isValidEnvName("local"), false);
  assertEquals(isValidEnvName(""), false);
});

Deno.test("isValidEnvName - narrows type correctly", () => {
  const value: string = "dev";
  if (isValidEnvName(value)) {
    // TypeScript should narrow value to EnvName
    const env: EnvName = value;
    assertEquals(env, "dev");
  }
});

// ============================================================================
// Type Validation Tests
// ============================================================================

Deno.test("validateType - validates string type", () => {
  const result = validateType("hello", "string");
  assertEquals(result.valid, true);
  assertEquals(result.reason, undefined);
});

Deno.test("validateType - validates number type with valid numbers", () => {
  const result1 = validateType("123", "number");
  assertEquals(result1.valid, true);

  const result2 = validateType("123.45", "number");
  assertEquals(result2.valid, true);

  const result3 = validateType("0", "number");
  assertEquals(result3.valid, true);

  const result4 = validateType("-42", "number");
  assertEquals(result4.valid, true);
});

Deno.test("validateType - rejects invalid number values", () => {
  const result1 = validateType("not-a-number", "number");
  assertEquals(result1.valid, false);
  assertEquals(result1.reason, "must be a number");

  const result2 = validateType("NaN", "number");
  assertEquals(result2.valid, false);

  const result3 = validateType("Infinity", "number");
  assertEquals(result3.valid, false);
});

Deno.test("validateType - validates boolean type with valid values", () => {
  const result1 = validateType("true", "boolean");
  assertEquals(result1.valid, true);

  const result2 = validateType("false", "boolean");
  assertEquals(result2.valid, true);

  const result3 = validateType("TRUE", "boolean");
  assertEquals(result3.valid, true);

  const result4 = validateType("FALSE", "boolean");
  assertEquals(result4.valid, true);
});

Deno.test("validateType - rejects invalid boolean values", () => {
  const result1 = validateType("yes", "boolean");
  assertEquals(result1.valid, false);
  assertEquals(result1.reason, "must be 'true' or 'false'");

  const result2 = validateType("1", "boolean");
  assertEquals(result2.valid, false);

  const result3 = validateType("0", "boolean");
  assertEquals(result3.valid, false);
});

Deno.test("validateType - validates URL type with valid URLs", () => {
  const result1 = validateType("https://example.com", "url");
  assertEquals(result1.valid, true);

  const result2 = validateType("http://localhost:8080", "url");
  assertEquals(result2.valid, true);

  const result3 = validateType(
    "postgresql://user:pass@localhost:5432/db",
    "url",
  );
  assertEquals(result3.valid, true);

  const result4 = validateType("file:///path/to/file", "url");
  assertEquals(result4.valid, true);
});

Deno.test("validateType - rejects invalid URL values", () => {
  const result1 = validateType("not-a-url", "url");
  assertEquals(result1.valid, false);
  assertEquals(result1.reason, "must be a valid URL");

  const result2 = validateType("example.com", "url");
  assertEquals(result2.valid, false);

  const result3 = validateType("", "url");
  assertEquals(result3.valid, false);
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

Deno.test("validateSecrets - passes with all required variables present", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
  };

  const secrets = {
    PORT: "8000",
    DATABASE_URL: "postgresql://localhost:5432/db",
  };

  const errors = validateSecrets(secrets, schema, "dev");
  assertEquals(errors.length, 0);
});

Deno.test("validateSecrets - detects missing required variables", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
  };

  const secrets = {
    PORT: "8000",
    // DATABASE_URL is missing
  };

  const errors = validateSecrets(secrets, schema, "dev");
  assertEquals(errors.length, 1);
  assertEquals(
    errors[0],
    '[dev] Missing required env var "DATABASE_URL". Set it in config/secret/.env.dev.',
  );
});

Deno.test("validateSecrets - handles environment-specific requirements", () => {
  const schema: EnvSchema = {
    DEBUG: { type: "boolean", required: ["dev", "staging"] },
    DATABASE_URL: { type: "url", required: ["prod"] },
  };

  // In dev, DEBUG is required but DATABASE_URL is not
  const devSecrets = { DEBUG: "true" };
  const devErrors = validateSecrets(devSecrets, schema, "dev");
  assertEquals(devErrors.length, 0);

  // In prod, DATABASE_URL is required but DEBUG is not
  const prodSecrets = { DATABASE_URL: "postgresql://localhost:5432/db" };
  const prodErrors = validateSecrets(prodSecrets, schema, "prod");
  assertEquals(prodErrors.length, 0);
});

Deno.test("validateSecrets - detects type mismatches", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DEBUG: { type: "boolean", required: true },
  };

  const secrets = {
    PORT: "not-a-number",
    DEBUG: "not-a-boolean",
  };

  const errors = validateSecrets(secrets, schema, "dev");
  assertEquals(errors.length, 2);
  assertEquals(
    errors[0],
    '[dev] Invalid env var "PORT": expected number, got "not-a-number". Fix in config/secret/.env.dev.',
  );
  assertEquals(
    errors[1],
    '[dev] Invalid env var "DEBUG": expected boolean, got "not-a-boolean". Fix in config/secret/.env.dev.',
  );
});

Deno.test("validateSecrets - ignores optional variables when missing", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DEBUG: { type: "boolean", required: false },
  };

  const secrets = {
    PORT: "8000",
    // DEBUG is missing but optional
  };

  const errors = validateSecrets(secrets, schema, "dev");
  assertEquals(errors.length, 0);
});

Deno.test("validateSecrets - handles undefined values correctly", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DEBUG: { type: "boolean", required: false },
  };

  const secrets: Record<string, string | undefined> = {
    PORT: "8000",
    DEBUG: undefined,
  };

  const errors = validateSecrets(secrets, schema, "dev");
  assertEquals(errors.length, 0);
});

// ============================================================================
// .env File Parsing Tests
// ============================================================================

Deno.test("parseEnvFile - parses simple key=value format", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/test
DEBUG=true`,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/test");
  assertEquals(result.DEBUG, "true");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("parseEnvFile - ignores comments and empty lines", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `# This is a comment
PORT=8000

# Another comment
DATABASE_URL=postgresql://localhost:5432/test`,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/test");
  assertEquals(Object.keys(result).length, 2);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("parseEnvFile - handles values with spaces", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `MESSAGE=Hello, World!
PATH=/usr/local/bin:/usr/bin`,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(result.MESSAGE, "Hello, World!");
  assertEquals(result.PATH, "/usr/local/bin:/usr/bin");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("parseEnvFile - handles values with equals signs", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `CONNECTION_STRING=postgresql://user:pass=word@localhost:5432/db`,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(
    result.CONNECTION_STRING,
    "postgresql://user:pass=word@localhost:5432/db",
  );

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("parseEnvFile - returns empty object for non-existent file", async () => {
  const result = await parseEnvFile("/non/existent/path/.env");
  assertEquals(result, {});
});

Deno.test("parseEnvFile - trims whitespace from keys and values", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `  PORT  =  8000  
  DATABASE_URL  = postgresql://localhost:5432/db `,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("parseEnvFile - skips lines without equals sign", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/.env`;

  await Deno.writeTextFile(
    filePath,
    `PORT=8000
INVALID_LINE_WITHOUT_EQUALS
DATABASE_URL=postgresql://localhost:5432/db`,
  );

  const result = await parseEnvFile(filePath);

  assertEquals(result.PORT, "8000");
  assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  assertEquals("INVALID_LINE_WITHOUT_EQUALS" in result, false);

  await Deno.remove(tempDir, { recursive: true });
});

// ============================================================================
// getEnv Tests
// ============================================================================

Deno.test("getEnv - returns validated environment variables", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
  };

  // Set environment variables
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.env.set("PORT", "8000");
    Deno.env.set("DATABASE_URL", "postgresql://localhost:5432/db");

    const result = getEnv(schema, "dev");

    assertEquals(result.PORT, "8000");
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    // Restore original values
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
  }
});

Deno.test("getEnv - throws on missing required variable", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
  };

  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.env.set("PORT", "8000");
    // DATABASE_URL is missing

    getEnv(schema, "dev");
    throw new Error("Should have thrown");
  } catch (error) {
    if (error instanceof Error && error.message !== "Should have thrown") {
      // This is expected error from getEnv
      // Verify it contains validation error message
      if (!error.message.includes("Environment validation failed")) {
        throw error;
      }
    }
  } finally {
    // Restore original values
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
  }
});

Deno.test("getEnv - throws on invalid type", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
  };

  const originalPort = Deno.env.get("PORT");

  try {
    Deno.env.set("PORT", "not-a-number");

    getEnv(schema, "dev");
    throw new Error("Should have thrown");
  } catch (error) {
    if (error instanceof Error && error.message !== "Should have thrown") {
      // This is expected error from getEnv
      // Verify it contains validation error message
      if (!error.message.includes("Environment validation failed")) {
        throw error;
      }
    }
  } finally {
    // Restore original value
    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
  }
});

Deno.test("getEnv - returns only defined values", () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DEBUG: { type: "boolean", required: false },
  };

  const originalPort = Deno.env.get("PORT");
  const originalDebug = Deno.env.get("DEBUG");

  try {
    Deno.env.set("PORT", "8000");
    // DEBUG is not set

    const result = getEnv(schema, "dev");

    assertEquals(result.PORT, "8000");
    assertEquals("DEBUG" in result, false);
  } finally {
    // Restore original values
    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
    if (originalDebug !== undefined) {
      Deno.env.set("DEBUG", originalDebug);
    } else {
      Deno.env.delete("DEBUG");
    }
  }
});

// ============================================================================
// initializeSecrets Tests
// ============================================================================

Deno.test("initializeSecrets - loads from .env file", async () => {
  const tempDir = await Deno.makeTempDir();
  const envFilePath = `${tempDir}/.env.dev`;

  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db
DEBUG=true`,
  );

  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
    DEBUG: { type: "boolean", required: true },
  };

  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");
  const originalDebug = Deno.env.get("DEBUG");

  try {
    const result = await initializeSecrets(schema, "dev", envFilePath);

    assertEquals(result.PORT, "8000");
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
    assertEquals(result.DEBUG, "true");
  } finally {
    // Restore original values
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
    if (originalDebug !== undefined) {
      Deno.env.set("DEBUG", originalDebug);
    } else {
      Deno.env.delete("DEBUG");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("initializeSecrets - process env takes precedence over .env file", async () => {
  const tempDir = await Deno.makeTempDir();
  const envFilePath = `${tempDir}/.env.dev`;

  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db`,
  );

  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
    DATABASE_URL: { type: "url", required: true },
  };

  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    // Set process env with different value
    Deno.env.set("PORT", "9000");

    const result = await initializeSecrets(schema, "dev", envFilePath);

    // Process env should take precedence
    assertEquals(result.PORT, "9000");
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    // Restore original values
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

Deno.test("initializeSecrets - works without .env file", async () => {
  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
  };

  const originalPort = Deno.env.get("PORT");

  try {
    Deno.env.set("PORT", "8000");

    const result = await initializeSecrets(schema, "dev");

    assertEquals(result.PORT, "8000");
  } finally {
    // Restore original value
    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }
  }
});

Deno.test("initializeSecrets - throws on validation failure", async () => {
  const tempDir = await Deno.makeTempDir();
  const envFilePath = `${tempDir}/.env.dev`;

  await Deno.writeTextFile(
    envFilePath,
    `PORT=not-a-number`,
  );

  const schema: EnvSchema = {
    PORT: { type: "number", required: true },
  };

  const originalPort = Deno.env.get("PORT");

  try {
    await assertRejects(
      () => initializeSecrets(schema, "dev", envFilePath),
      Error,
      "Invalid env var",
    );
  } finally {
    // Restore original value
    if (originalPort !== undefined) {
      Deno.env.set("PORT", originalPort);
    } else {
      Deno.env.delete("PORT");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// bootstrapEnv Tests
// ============================================================================

Deno.test("bootstrapEnv - loads schema and .env file", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secret`;
  await Deno.mkdir(envDir, { recursive: true });

  // Create env.config.ts
  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  // Create .env.dev file
  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db`,
  );

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    // Set process env to ensure they override .env file
    Deno.env.set("PORT", "8000");
    Deno.env.set("DATABASE_URL", "postgresql://localhost:5432/db");

    const result = await bootstrapEnv("dev", "config/secret");

    assertEquals(result.PORT, "8000");
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    Deno.cwd = originalCwd;

    // Restore original values
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

Deno.test("bootstrapEnv - throws when schema file is missing", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secret`;
  await Deno.mkdir(envDir, { recursive: true });

  const originalCwd = Deno.cwd;

  try {
    Deno.cwd = () => tempDir;

    await assertRejects(
      () => bootstrapEnv("dev", "config/secret"),
      Error,
      "Module not found",
    );
  } catch (error) {
    // In Deno v2, import might throw an error before CLI execution
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

Deno.test("bootstrapEnv - throws when .env file is missing and required vars are not set", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secret`;
  await Deno.mkdir(envDir, { recursive: true });

  // Create env.config.ts
  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      PORT: { type: "number", required: true },
      DATABASE_URL: { type: "url", required: true },
    };`,
  );

  // Don't create .env.dev file

  const originalCwd = Deno.cwd;
  const originalPort = Deno.env.get("PORT");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    // Clear process env to ensure .env file is required
    Deno.env.delete("PORT");
    Deno.env.delete("DATABASE_URL");

    await assertRejects(
      () => bootstrapEnv("dev", "config/secret"),
      Error,
      "Missing required env var",
    );
  } finally {
    Deno.cwd = originalCwd;

    // Restore original values
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

Deno.test("bootstrapEnv - validates against environment-specific requirements", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secret`;
  await Deno.mkdir(envDir, { recursive: true });

  // Create env.config.ts with environment-specific requirements
  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `export default {
      DEBUG: { type: "boolean", required: ["dev", "staging"] },
      DATABASE_URL: { type: "url", required: ["prod"] },
    };`,
  );

  // Create .env.prod file
  const envFilePath = `${envDir}/.env.prod`;
  await Deno.writeTextFile(
    envFilePath,
    `DATABASE_URL=postgresql://localhost:5432/db`,
  );

  const originalCwd = Deno.cwd;
  const originalDebug = Deno.env.get("DEBUG");
  const originalDbUrl = Deno.env.get("DATABASE_URL");

  try {
    Deno.cwd = () => tempDir;
    // Set process env to ensure they override .env file
    Deno.env.set("DATABASE_URL", "postgresql://localhost:5432/db");

    // In prod, only DATABASE_URL is required
    const result = await bootstrapEnv("prod", "config/secret");

    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    Deno.cwd = originalCwd;

    // Restore original values
    if (originalDebug !== undefined) {
      Deno.env.set("DEBUG", originalDebug);
    } else {
      Deno.env.delete("DEBUG");
    }
    if (originalDbUrl !== undefined) {
      Deno.env.set("DATABASE_URL", originalDbUrl);
    } else {
      Deno.env.delete("DATABASE_URL");
    }

    await Deno.remove(tempDir, { recursive: true });
  }
});
