import { assertEquals, assertExists } from "std/assert";

import { DEFAULT_CONFIG, TSera } from "./tsera.ts";

Deno.test("TSera.config - should have config property", () => {
  assertExists(TSera.config);
});

Deno.test("TSera.config - should return config with required properties", () => {
  assertEquals(typeof TSera.config.openapi, "boolean");
  assertEquals(typeof TSera.config.docs, "boolean");
  assertEquals(typeof TSera.config.tests, "boolean");
  assertEquals(typeof TSera.config.paths, "object");
  assertExists(TSera.config.db);
  assertExists(TSera.config.deploy);
});

Deno.test("TSera.env - should have env module", () => {
  assertExists(TSera.env);
  assertExists(TSera.env.has);
});

Deno.test("TSera - should return same config on multiple accesses (cached)", () => {
  const config1 = TSera.config;
  const config2 = TSera.config;
  assertEquals(config1, config2);
});

Deno.test("DEFAULT_CONFIG - should have required properties", () => {
  assertExists(DEFAULT_CONFIG.openapi);
  assertExists(DEFAULT_CONFIG.docs);
  assertExists(DEFAULT_CONFIG.tests);
  assertExists(DEFAULT_CONFIG.paths);
  assertExists(DEFAULT_CONFIG.db);
  assertExists(DEFAULT_CONFIG.deploy);
});

Deno.test("DEFAULT_CONFIG - should have valid db config", () => {
  assertEquals(DEFAULT_CONFIG.db.dialect, "sqlite");
  assertExists(DEFAULT_CONFIG.db.file);
});
