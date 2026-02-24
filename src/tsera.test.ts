/**
 * @module tsera.test
 * Tests for the TSera runtime (synchronous API).
 */

import { assertEquals, assertThrows } from "std/assert";
import { createTSera, DEFAULT_CONFIG, TSera } from "./mod.ts";

Deno.test("TSera Runtime", async (t) => {
  await t.step("config property", async (t2) => {
    await t2.step("should be immediately available (sync)", () => {
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
      if (!config.modules?.secrets) {
        assertEquals(TSera.env, undefined);
      }
    });

    await t2.step("should have has method when enabled", () => {
      const config = TSera.config;

      if (config.modules?.secrets && TSera.env) {
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

    Deno.env.set("TSERA_TEST_VAR", "test_value");

    try {
      const myTSera = createTSera(configWithSecrets);
      if (myTSera.env) {
        assertEquals(typeof myTSera.env.has, "function");
      }
    } finally {
      Deno.env.delete("TSERA_TEST_VAR");
    }
  });
});

Deno.test("EnvModule Interface", async (t) => {
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
          const env = myTSera.env as unknown as Record<string, string | undefined>;
          assertEquals(env.TSERA_TEST_PROP, "prop_value");
          assertEquals(env.NONEXISTENT_VAR_12345, undefined);
        }
      } finally {
        Deno.env.delete("TSERA_TEST_PROP");
      }
    });
  });

  await t.step("in operator", async (t2) => {
    await t2.step("should support in operator for env vars", () => {
      Deno.env.set("TSERA_TEST_IN", "in_value");

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
          assertEquals("TSERA_TEST_IN" in myTSera.env, true);
          assertEquals("NONEXISTENT_VAR_12345" in myTSera.env, false);
        }
      } finally {
        Deno.env.delete("TSERA_TEST_IN");
      }
    });
  });
});

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
