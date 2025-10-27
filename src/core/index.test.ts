import { defineEntity, entityToDDL, entityToZod, isEntity, zodToOpenAPI } from "./index.ts";

function assertEquals<T>(actual: T, expected: T): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Assertion failed: ${actualJson} !== ${expectedJson}`);
  }
}

function assertStrictEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${String(actual)} !== ${String(expected)}`);
  }
}

Deno.test("defineEntity should freeze the returned object", () => {
  const entity = defineEntity({
    name: "User",
    table: true,
    columns: {
      id: { type: "string" },
    },
  });

  let threw = false;
  try {
    // deno-lint-ignore no-explicit-any
    (entity as any).name = "Patched";
  } catch {
    threw = true;
  }

  assertStrictEquals(entity.name, "User");
  assertEquals(threw, true);
  assertEquals(isEntity(entity), true);
});

Deno.test("entity helpers should produce deterministic artifacts", () => {
  const entity = defineEntity({
    name: "AuditLog",
    columns: {
      id: { type: "string" },
      createdAt: { type: "date" },
      payload: { type: { arrayOf: "json" }, optional: true },
    },
  });

  const schema = entityToZod(entity);
  assertEquals(Object.keys(schema.shape), ["id", "createdAt", "payload"]);

  const openapi = zodToOpenAPI(schema, { title: "Audit", version: "0.0.0" });
  assertEquals(openapi.openapi, "3.1.0");
  assertEquals(openapi.info.title, "Audit");

  const ddl = entityToDDL(entity);
  assertEquals(
    ddl,
    "CREATE TABLE IF NOT EXISTS AuditLog (\n" +
      "  id TEXT NOT NULL,\n" +
      "  createdAt TIMESTAMP NOT NULL,\n" +
      "  payload JSONB[]\n" +
      ");",
  );
});
