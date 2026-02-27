/**
 * Tests for secrets management system with EnvConfigSchema format.
 */

import { assertEquals, assertRejects } from "std/assert";
import {
  bootstrapEnv,
  configureEnvNames,
  createEnvModule,
  DEFAULT_ENV_NAMES,
  detectEnvName,
  type EnvName,
  EnvValidationError,
  type EnvValue,
  getConfiguredEnvNames,
  initializeEnvModule,
  isValidEnvName,
  parseEnvFile,
} from "../secrets.ts";

// ============================================================================
// Helper to reset environment names between tests
// ============================================================================

function resetEnvNames() {
  configureEnvNames([...DEFAULT_ENV_NAMES]);
}

// ============================================================================
// Environment Configuration Tests
// ============================================================================

Deno.test("configureEnvNames - sets custom environment names", () => {
  try {
    configureEnvNames(["local", "test", "live"]);
    assertEquals(getConfiguredEnvNames(), ["local", "test", "live"]);
    assertEquals(isValidEnvName("local"), true);
    assertEquals(isValidEnvName("test"), true);
    assertEquals(isValidEnvName("live"), true);
    assertEquals(isValidEnvName("dev"), false);
  } finally {
    resetEnvNames();
  }
});

Deno.test("getConfiguredEnvNames - returns default names when not configured", () => {
  resetEnvNames();
  assertEquals(getConfiguredEnvNames(), ["dev", "staging", "prod"]);
});

// ============================================================================
// Type Guard Tests
// ============================================================================

Deno.test("isValidEnvName - returns true for valid environment names", () => {
  resetEnvNames();
  assertEquals(isValidEnvName("dev"), true);
  assertEquals(isValidEnvName("staging"), true);
  assertEquals(isValidEnvName("prod"), true);
});

Deno.test("isValidEnvName - returns false for invalid environment names", () => {
  resetEnvNames();
  assertEquals(isValidEnvName("production"), false);
  assertEquals(isValidEnvName("test"), false);
  assertEquals(isValidEnvName("local"), false);
  assertEquals(isValidEnvName(""), false);
});

Deno.test("isValidEnvName - narrows type correctly", () => {
  resetEnvNames();
  const value: string = "dev";
  if (isValidEnvName(value)) {
    const env: EnvName = value;
    assertEquals(env, "dev");
  }
});

Deno.test("isValidEnvName - works with custom environment names", () => {
  try {
    configureEnvNames(["development", "staging", "production"]);
    assertEquals(isValidEnvName("development"), true);
    assertEquals(isValidEnvName("production"), true);
    assertEquals(isValidEnvName("dev"), false);
  } finally {
    resetEnvNames();
  }
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
// EnvModule Proxy Tests
// ============================================================================

Deno.test("createEnvModule - creates module with has() method", () => {
  const envValues: Record<string, EnvValue> = {
    PORT: 8000,
    DEBUG: undefined,
  };

  const envModule = createEnvModule(envValues);

  assertEquals(typeof envModule.has, "function");
  assertEquals(envModule.has("PORT"), true);
  assertEquals(envModule.has("DEBUG"), false);
  assertEquals(envModule.has("UNKNOWN"), false);
});

Deno.test("createEnvModule - allows property access for variables", () => {
  const envValues: Record<string, EnvValue> = {
    PORT: 8000,
    DATABASE_URL: "postgresql://localhost:5432/db",
    DEBUG: true,
  };

  const envModule = createEnvModule(envValues);

  assertEquals(envModule.PORT, 8000);
  assertEquals(envModule.DATABASE_URL, "postgresql://localhost:5432/db");
  assertEquals(envModule.DEBUG, true);
});

Deno.test("createEnvModule - returns undefined for missing optional variables", () => {
  const envValues: Record<string, EnvValue> = {
    PORT: 8000,
    DEBUG: undefined,
  };

  const envModule = createEnvModule(envValues);

  assertEquals(envModule.DEBUG, undefined);
});

Deno.test("createEnvModule - supports `in` operator", () => {
  const envValues: Record<string, EnvValue> = {
    PORT: 8000,
    DEBUG: undefined,
  };

  const envModule = createEnvModule(envValues);

  assertEquals("PORT" in envModule, true);
  assertEquals("DEBUG" in envModule, true);
  assertEquals("has" in envModule, true);
  assertEquals("UNKNOWN" in envModule, false);
});

Deno.test("createEnvModule - supports Object.keys()", () => {
  const envValues: Record<string, EnvValue> = {
    PORT: 8000,
    DEBUG: undefined,
  };

  const envModule = createEnvModule(envValues);
  const keys = Object.keys(envModule);

  assertEquals(keys.includes("PORT"), true);
  assertEquals(keys.includes("DEBUG"), true);
  assertEquals(keys.includes("has"), true);
});

// ============================================================================
// EnvValidationError Tests
// ============================================================================

Deno.test("EnvValidationError - formats error message correctly", () => {
  const issues = [
    { path: ["PORT"], message: "Required" },
    {
      path: ["DEBUG"],
      message: "Expected boolean, received string",
    },
  ];

  const error = new EnvValidationError(issues, "dev");

  assertEquals(error.name, "EnvValidationError");
  assertEquals(error.errors.length, 2);
  assertEquals(error.envName, "dev");
  assertEquals(error.message.includes("Environment validation failed"), true);
  assertEquals(error.message.includes(".env.dev"), true);
});

// ============================================================================
// detectEnvName Tests
// ============================================================================

Deno.test("detectEnvName - returns 'dev' when DENO_ENV is not set", () => {
  resetEnvNames();
  assertEquals(detectEnvName({}), "dev");
});

Deno.test("detectEnvName - returns env from DENO_ENV when valid", () => {
  resetEnvNames();
  assertEquals(detectEnvName({ DENO_ENV: "prod" }), "prod");
  assertEquals(detectEnvName({ DENO_ENV: "staging" }), "staging");
  assertEquals(detectEnvName({ DENO_ENV: "dev" }), "dev");
});

Deno.test("detectEnvName - returns 'dev' for invalid DENO_ENV values", () => {
  resetEnvNames();
  assertEquals(detectEnvName({ DENO_ENV: "production" }), "dev");
  assertEquals(detectEnvName({ DENO_ENV: "test" }), "dev");
  assertEquals(detectEnvName({ DENO_ENV: "" }), "dev");
});

Deno.test("detectEnvName - works with custom environment names", () => {
  try {
    configureEnvNames(["local", "test", "live"]);
    assertEquals(detectEnvName({ DENO_ENV: "local" }), "local");
    assertEquals(detectEnvName({ DENO_ENV: "live" }), "live");
    assertEquals(detectEnvName({ DENO_ENV: "dev" }), "dev"); // Invalid with custom names
  } finally {
    resetEnvNames();
  }
});

// ============================================================================
// bootstrapEnv Tests with New EnvConfigSchema Format
// ============================================================================

Deno.test("bootstrapEnv - loads new EnvConfigSchema format and .env file", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  PORT: {
    validator: z.coerce.number(),
    required: true,
  },
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
  DEBUG: {
    validator: z.coerce.boolean(),
    required: true,
  },
};`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db
DEBUG=true`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);

    assertEquals(result.PORT, 8000);
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
    assertEquals(result.DEBUG, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - throws when schema file is missing", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  try {
    await assertRejects(
      () => bootstrapEnv("config/secrets/env.config.ts", envDir),
      Error,
      "not found",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - throws when required variable is missing (new format)", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
};`,
  );

  // Empty .env file - missing required DATABASE_URL
  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(envFilePath, ``);

  try {
    await assertRejects(
      () => bootstrapEnv(schemaPath, envDir),
      EnvValidationError,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - validates with Zod coercion (new format)", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  PORT: {
    validator: z.coerce.number(),
    required: true,
  },
  DEBUG: {
    validator: z.coerce.boolean(),
    required: true,
  },
};`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DEBUG=true`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);

    assertEquals(typeof result.PORT, "number");
    assertEquals(result.PORT, 8000);
    assertEquals(typeof result.DEBUG, "boolean");
    assertEquals(result.DEBUG, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - optional variables return undefined when not set", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  PORT: {
    validator: z.coerce.number(),
    required: false,
  },
  DEBUG: {
    validator: z.coerce.boolean(),
    required: false,
  },
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
};`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `DATABASE_URL=postgresql://localhost:5432/db`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);

    assertEquals(result.PORT, undefined);
    assertEquals(result.DEBUG, undefined);
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - environment-specific required variables", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
  SENTRY_DSN: {
    validator: z.string().url(),
    required: ["prod"], // Only required in prod
  },
  DEBUG: {
    validator: z.coerce.boolean(),
    required: false,
  },
};`,
  );

  // Test in dev environment - SENTRY_DSN should be optional
  // .env.dev file with DENO_ENV=dev
  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `DENO_ENV=dev
DATABASE_URL=postgresql://localhost:5432/db`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
    assertEquals(result.SENTRY_DSN, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - throws when env-specific required variable is missing", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
  SENTRY_DSN: {
    validator: z.string().url(),
    required: ["prod"], // Only required in prod
  },
};`,
  );

  // Create .env.dev that points to prod
  const envDevPath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envDevPath,
    `DENO_ENV=prod`,
  );

  // Create .env.prod without SENTRY_DSN (should fail)
  const envProdPath = `${envDir}/.env.prod`;
  await Deno.writeTextFile(
    envProdPath,
    `DENO_ENV=prod
DATABASE_URL=postgresql://localhost:5432/db`,
  );

  try {
    await assertRejects(
      () => bootstrapEnv(schemaPath, envDir),
      EnvValidationError,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - throws EnvValidationError with detailed issues (new format)", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  PORT: {
    validator: z.coerce.number(),
    required: true,
  },
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
};`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=not-a-number
DATABASE_URL=invalid-url`,
  );

  try {
    await assertRejects(
      () => bootstrapEnv(schemaPath, envDir),
      EnvValidationError,
    );
  } catch (error) {
    if (error instanceof EnvValidationError) {
      assertEquals(error.errors.length >= 1, true);
      assertEquals(error.envName, "dev");
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// bootstrapEnv Tests with Legacy Zod Schema Format (Backward Compatibility)
// ============================================================================

Deno.test("bootstrapEnv - supports legacy Zod schema format", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  DEBUG: z.coerce.boolean().default(false),
});`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db
DEBUG=true`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);

    assertEquals(result.PORT, 8000);
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
    assertEquals(result.DEBUG, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - legacy format throws when .env file is missing required vars", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default z.object({
  DATABASE_URL: z.string().url(),
});`,
  );

  try {
    await assertRejects(
      () => bootstrapEnv(schemaPath, envDir),
      EnvValidationError,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("bootstrapEnv - legacy format uses default values from Zod schema", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default z.object({
  PORT: z.coerce.number().default(3000),
  DEBUG: z.coerce.boolean().default(false),
  DATABASE_URL: z.string().url(),
});`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `DATABASE_URL=postgresql://localhost:5432/db`,
  );

  try {
    const result = await bootstrapEnv(schemaPath, envDir);

    assertEquals(result.PORT, 3000);
    assertEquals(result.DEBUG, false);
    assertEquals(result.DATABASE_URL, "postgresql://localhost:5432/db");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// initializeEnvModule Tests
// ============================================================================

Deno.test("initializeEnvModule - creates EnvModule from new format config and env files", async () => {
  const tempDir = await Deno.makeTempDir();
  const envDir = `${tempDir}/config/secrets`;
  await Deno.mkdir(envDir, { recursive: true });

  const schemaPath = `${envDir}/env.config.ts`;
  await Deno.writeTextFile(
    schemaPath,
    `import { z } from "zod";
export default {
  PORT: {
    validator: z.coerce.number(),
    required: true,
  },
  DATABASE_URL: {
    validator: z.string().url(),
    required: true,
  },
  DEBUG: {
    validator: z.coerce.boolean(),
    required: true,
  },
};`,
  );

  const envFilePath = `${envDir}/.env.dev`;
  await Deno.writeTextFile(
    envFilePath,
    `PORT=8000
DATABASE_URL=postgresql://localhost:5432/db
DEBUG=true`,
  );

  try {
    const envModule = await initializeEnvModule(schemaPath, envDir);

    assertEquals(envModule.PORT, 8000);
    assertEquals(envModule.DATABASE_URL, "postgresql://localhost:5432/db");
    assertEquals(envModule.DEBUG, true);

    assertEquals(envModule.has("PORT"), true);
    assertEquals(envModule.has("DATABASE_URL"), true);
    assertEquals(envModule.has("DEBUG"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
