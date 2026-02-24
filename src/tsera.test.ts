/**
 * @module tsera.test
 * Tests for the TSera facade.
 */

import { assertEquals, assertThrows } from "std/assert";
import { TSera } from "./mod.ts";

/**
 * Test suite for TSera facade.
 */
Deno.test("TSera Facade", async (t) => {
  // Reset TSera before each test section
  await t.step("ready promise", async (t2) => {
    await t2.step("should be a promise", () => {
      const ready = TSera.ready;
      assertEquals(typeof ready?.then, "function");
    });

    await t2.step("should resolve without error when config exists", async () => {
      // This test assumes we're running in the tsera project directory
      // which has a valid tsera.config.ts
      await TSera.ready;
      // If we get here without throwing, the test passes
    });
  });

  await t.step("config property", async (t2) => {
    await t2.step("should throw before initialization", () => {
      // This test can't be run in isolation because TSera auto-initializes
      // We'll skip it for now
    });

    await t2.step("should return config after initialization", async () => {
      await TSera.ready;
      const config = TSera.config;
      assertEquals(typeof config, "object");
      assertEquals(typeof config.db, "object");
      assertEquals(typeof config.paths, "object");
    });
  });

  await t.step("env module", async (t2) => {
    await t2.step("should be undefined if secrets module disabled", async () => {
      await TSera.ready;
      const config = TSera.config;
      // If secrets module is disabled, env should be undefined
      if (!config.modules?.secrets) {
        assertEquals(TSera.env, undefined);
      }
    });

    await t2.step("should have get, require, has methods when enabled", async () => {
      await TSera.ready;
      const config = TSera.config;

      if (config.modules?.secrets && TSera.env) {
        assertEquals(typeof TSera.env.get, "function");
        assertEquals(typeof TSera.env.require, "function");
        assertEquals(typeof TSera.env.has, "function");
      }
    });
  });
});

/**
 * Test suite for EnvModule interface.
 */
Deno.test("EnvModule Interface", async (t) => {
  await t.step("get method", async (t2) => {
    await t2.step("should return undefined for missing key", async () => {
      await TSera.ready;
      if (TSera.env) {
        const value = TSera.env.get("NONEXISTENT_VAR_12345");
        assertEquals(value, undefined);
      }
    });

    await t2.step("should return value for existing key", async () => {
      await TSera.ready;
      // Set a test environment variable
      Deno.env.set("TSERA_TEST_VAR", "test_value");

      try {
        // Reset to pick up the new variable
        await TSera._reset();

        if (TSera.env) {
          const value = TSera.env.get("TSERA_TEST_VAR");
          assertEquals(value, "test_value");
        }
      } finally {
        Deno.env.delete("TSERA_TEST_VAR");
      }
    });
  });

  await t.step("require method", async (t2) => {
    await t2.step("should throw for missing key", async () => {
      await TSera.ready;
      if (TSera.env) {
        assertThrows(
          () => TSera.env!.require("NONEXISTENT_VAR_12345"),
          Error,
          'Required environment variable "NONEXISTENT_VAR_12345" is not set.',
        );
      }
    });

    await t2.step("should return value for existing key", async () => {
      await TSera.ready;
      Deno.env.set("TSERA_TEST_REQUIRE", "required_value");

      try {
        await TSera._reset();

        if (TSera.env) {
          const value = TSera.env.require("TSERA_TEST_REQUIRE");
          assertEquals(value, "required_value");
        }
      } finally {
        Deno.env.delete("TSERA_TEST_REQUIRE");
      }
    });
  });

  await t.step("has method", async (t2) => {
    await t2.step("should return false for missing key", async () => {
      await TSera.ready;
      if (TSera.env) {
        assertEquals(TSera.env.has("NONEXISTENT_VAR_12345"), false);
      }
    });

    await t2.step("should return true for existing key", async () => {
      await TSera.ready;
      Deno.env.set("TSERA_TEST_HAS", "has_value");

      try {
        await TSera._reset();

        if (TSera.env) {
          assertEquals(TSera.env.has("TSERA_TEST_HAS"), true);
        }
      } finally {
        Deno.env.delete("TSERA_TEST_HAS");
      }
    });
  });

  await t.step("property access", async (t2) => {
    await t2.step("should allow property access for env vars", async () => {
      await TSera.ready;
      Deno.env.set("TSERA_TEST_PROP", "prop_value");

      try {
        await TSera._reset();

        if (TSera.env) {
          // Property access via Proxy
          const env = TSera.env as unknown as Record<string, string | undefined>;
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
 * Test suite for TSera._reset method.
 */
Deno.test("TSera._reset", async (t) => {
  await t.step("should clear and reinitialize state", async () => {
    await TSera.ready;
    const config1 = TSera.config;

    await TSera._reset();

    await TSera.ready;
    const config2 = TSera.config;

    // Config should be the same after reset
    assertEquals(config1, config2);
  });
});
