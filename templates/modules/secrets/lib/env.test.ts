import { assertEquals, assertFalse } from "../testing/asserts.ts";
import { defineEnvSchema, validateEnv } from "tsera/core/secrets.ts";

Deno.test("validateEnv - passes with all required variables", () => {
  const schema = defineEnvSchema({
    TEST_VAR: {
      type: "string",
      required: true,
    },
  });

  Deno.env.set("TEST_VAR", "test-value");

  const result = validateEnv(schema, "dev");

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.values.TEST_VAR, "test-value");

  Deno.env.delete("TEST_VAR");
});

Deno.test("validateEnv - fails with missing required variable", () => {
  const schema = defineEnvSchema({
    MISSING_VAR: {
      type: "string",
      required: true,
    },
  });

  const result = validateEnv(schema, "dev");

  assertFalse(result.valid);
  assertEquals(result.errors.length, 1);
  assertEquals(
    result.errors[0],
    "Missing required environment variable: MISSING_VAR",
  );
});

Deno.test("validateEnv - uses default value when variable not set", () => {
  const schema = defineEnvSchema({
    DEFAULT_VAR: {
      type: "number",
      required: false,
      default: 42,
    },
  });

  const result = validateEnv(schema, "dev");

  assertEquals(result.valid, true);
  assertEquals(result.values.DEFAULT_VAR, 42);
});

Deno.test("validateEnv - parses number correctly", () => {
  const schema = defineEnvSchema({
    NUM_VAR: {
      type: "number",
      required: true,
    },
  });

  Deno.env.set("NUM_VAR", "123");

  const result = validateEnv(schema, "dev");

  assertEquals(result.valid, true);
  assertEquals(result.values.NUM_VAR, 123);

  Deno.env.delete("NUM_VAR");
});

Deno.test("validateEnv - parses boolean correctly", () => {
  const schema = defineEnvSchema({
    BOOL_VAR: {
      type: "boolean",
      required: true,
    },
  });

  Deno.env.set("BOOL_VAR", "true");

  const result = validateEnv(schema, "dev");

  assertEquals(result.valid, true);
  assertEquals(result.values.BOOL_VAR, true);

  Deno.env.delete("BOOL_VAR");
});

Deno.test("validateEnv - respects environment-specific requirements", () => {
  const schema = defineEnvSchema({
    PROD_ONLY: {
      type: "string",
      required: { dev: false, preprod: false, prod: true },
    },
  });

  // Should pass in dev (not required)
  const devResult = validateEnv(schema, "dev");
  assertEquals(devResult.valid, true);

  // Should fail in prod (required)
  const prodResult = validateEnv(schema, "prod");
  assertFalse(prodResult.valid);
});

Deno.test("validateEnv - filters by environment", () => {
  const schema = defineEnvSchema({
    DEV_ONLY: {
      type: "string",
      required: true,
      environments: ["dev"],
    },
  });

  // Should check in dev
  const devResult = validateEnv(schema, "dev");
  assertFalse(devResult.valid); // Missing variable

  // Should skip in prod
  const prodResult = validateEnv(schema, "prod");
  assertEquals(prodResult.valid, true); // Skipped, so valid
});

