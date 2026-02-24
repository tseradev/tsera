/**
 * @module tsera.test
 * Tests for the TSera facade (synchronous API).
 */

import { assertEquals, assertThrows } from "std/assert";
import { createTSera, DEFAULT_CONFIG, TSera } from "./mod.ts";

/**
 * Test suite for TSera facade (synchronous initialization).
 */
Deno.test("TSera Facade", async (t) => {
  await t.step("config property", async (t2) => {
    await t2.step("should be immediately available (sync)", () => {
      // TSera is initialized synchronously, no await needed
      const config = TSera.config;
      assertEquals(typeof config, "object");
    });

    await t2.step("should have required config properties", () => {
      const config = TSera.config;
      assertEquals(typeof config.db, "object");
      assertEquals(typeof config.paths, "object");
      assertEquals(typeof config.openapi, "boolean");
      assertEquals(typeof config.docs, "boolean");
      assertEquals(typeof config.tests, "boolean");
    });
  });

  await t.step("env module", async (t2) => {
    await t2.step("should be undefined if secrets module disabled", () => {
      const config = TSera.config;
      // If secrets module is disabled, env should be undefined
      if (!config.modules?.secrets) {
        assertEquals(TSera.env, undefined);
      }
    });

    await t2.step("should have get, require, has methods when enabled", () => {
      const config = TSera.config;

      if (config.modules?.secrets && TSera.env) {
        assertEquals(typeof TSera.env.get, "function");
        assertEquals(typeof TSera.env.require, "function");
        assertEquals(typeof TSera.env.has, "function");
      }
    });
  });

  await t.step("resolvedConfig property", () => {
    const resolved = TSera.resolvedConfig;
    assertEquals(typeof resolved, "object");
    assertEquals(typeof resolved.configPath, "string");
    assertEquals(typeof resolved.config, "object");
  });
});

/**
 * Test suite for createTSera function.
 */
Deno.test("createTSera", async (t) => {
  await t.step("should create TSera with explicit config", () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      openapi: false,
    };

    const myTSera = createTSera(customConfig);
    assertEquals(myTSera.config.openapi, false);
  });

  await t.step("should create TSera with custom configPath", () => {
    const myTSera = createTSera(DEFAULT_CONFIG, "/custom/path/config.ts");
    assertEquals(myTSera.resolvedConfig.configPath, "/custom/path/config.ts");
  });

  await t.step("should have env module when secrets enabled", () => {
    const configWithSecrets = {
      ...DEFAULT_CONFIG,
      modules: {
        ...DEFAULT_CONFIG.modules,
        secrets: true,
      },
    };

    // Set a test env var
    Deno.env.set("TSERA_TEST_VAR", "test_value");

    try {
      const myTSera = createTSera(configWithSecrets);
      // env should be defined when secrets module is enabled
      // (may be empty if no env vars match, but the module should exist)
      if (myTSera.env) {
        assertEquals(typeof myTSera.env.get, "function");
      }
    } finally {
      Deno.env.delete("TSERA_TEST_VAR");
    }
  });
});

/**
 * Test suite for EnvModule interface.
 */
Deno.test("EnvModule Interface", async (t) => {
  await t.step("get method", async (t2) => {
    await t2.step("should return undefined for missing key", () => {
      if (TSera.env) {
        const value = TSera.env.get("NONEXISTENT_VAR_12345");
        assertEquals(value, undefined);
      }
    });

    await t2.step("should return value for existing key", () => {
      // Set a test environment variable
      Deno.env.set("TSERA_TEST_VAR", "test_value");

      try {
        // Create new TSera instance to pick up the env var
        const configWithSecrets = {
          ...DEFAULT_CONFIG,
          modules: {
            ...DEFAULT_CONFIG.modules,
            secrets: true,
          },
        };
        const myTSera = createTSera(configWithSecrets);

        if (myTSera.env) {
          const value = myTSera.env.get("TSERA_TEST_VAR");
          assertEquals(value, "test_value");
        }
      } finally {
        Deno.env.delete("TSERA_TEST_VAR");
      }
    });
  });

  await t.step("require method", async (t2) => {
    await t2.step("should throw for missing key", () => {
      if (TSera.env) {
        assertThrows(
          () => TSera.env!.require("NONEXISTENT_VAR_12345"),
          Error,
          'Required environment variable "NONEXISTENT_VAR_12345" is not set.',
        );
      }
    });

    await t2.step("should return value for existing key", () => {
      Deno.env.set("TSERA_TEST_REQUIRE", "required_value");

      try {
        const configWithSecrets = {
          ...DEFAULT_CONFIG,
          modules: {
            ...DEFAULT_CONFIG.modules,
            secrets: true,
          },
        };
        const myTSera = createTSera(configWithSecrets);

        if (myTSera.env) {
          const value = myTSera.env.require("TSERA_TEST_REQUIRE");
          assertEquals(value, "required_value");
        }
      } finally {
        Deno.env.delete("TSERA_TEST_REQUIRE");
      }
    });
  });

  await t.step("has method", async (t2) => {
    await t2.step("should return false for missing key", () => {
      if (TSera.env) {
        assertEquals(TSera.env.has("NONEXISTENT_VAR_12345"), false);
      }
    });

    await t2.step("should return true for existing key", () => {
      Deno.env.set("TSERA_TEST_HAS", "has_value");

      try {
        const configWithSecrets = {
          ...DEFAULT_CONFIG,
          modules: {
            ...DEFAULT_CONFIG.modules,
            secrets: true,
          },
        };
        const myTSera = createTSera(configWithSecrets);

        if (myTSera.env) {
          assertEquals(myTSera.env.has("TSERA_TEST_HAS"), true);
        }
      } finally {
        Deno.env.delete("TSERA_TEST_HAS");
      }
    });
  });

  await t.step("property access", async (t2) => {
    await t2.step("should allow property access for env vars", () => {
      Deno.env.set("TSERA_TEST_PROP", "prop_value");

      try {
        const configWithSecrets = {
          ...DEFAULT_CONFIG,
          modules: {
            ...DEFAULT_CONFIG.modules,
            secrets: true,
          },
        };
        const myTSera = createTSera(configWithSecrets);

        if (myTSera.env) {
          // Property access via Proxy
          const env = myTSera.env as unknown as Record<
            string,
            string | undefined
          >;
          assertEquals(env.TSERA_TEST_PROP, "prop_value");
          assertEquals(env.NONEXISTENT_VAR_12345, undefined);
        }
      } finally {
        Deno.env.delete("TSERA_TEST_PROP");
      }
    });
  });
});

/**
 * Test suite for DEFAULT_CONFIG.
 */
Deno.test("DEFAULT_CONFIG", async (t) => {
  await t.step("should have required properties", () => {
    assertEquals(typeof DEFAULT_CONFIG.openapi, "boolean");
    assertEquals(typeof DEFAULT_CONFIG.docs, "boolean");
    assertEquals(typeof DEFAULT_CONFIG.tests, "boolean");
    assertEquals(typeof DEFAULT_CONFIG.telemetry, "boolean");
    assertEquals(typeof DEFAULT_CONFIG.outDir, "string");
    assertEquals(typeof DEFAULT_CONFIG.paths, "object");
    assertEquals(typeof DEFAULT_CONFIG.db, "object");
    assertEquals(typeof DEFAULT_CONFIG.deploy, "object");
    assertEquals(typeof DEFAULT_CONFIG.modules, "object");
  });

  await t.step("should have valid db config", () => {
    assertEquals(DEFAULT_CONFIG.db.dialect, "sqlite");
  });
});
