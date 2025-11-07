import { assertEquals, assertStringIncludes } from "../../testing/asserts.ts";
import { defineEntity, entityToDDL } from "../index.ts";

const userEntity = defineEntity({
  name: "UserAccount",
  table: true,
  columns: {
    id: { type: "string" },
    email: { type: "string", optional: true, default: "anonymous@example.com" },
    createdAt: { type: "date" },
    preferences: { type: "json", optional: true, default: { theme: "light" } },
  },
});

Deno.test("entityToDDL emits a CREATE TABLE statement", () => {
  const ddl = entityToDDL(userEntity);

  assertStringIncludes(ddl, 'CREATE TABLE IF NOT EXISTS "user_account"');
  assertStringIncludes(ddl, '"id" TEXT NOT NULL');
  assertStringIncludes(ddl, "\"email\" TEXT DEFAULT 'anonymous@example.com'");
  assertStringIncludes(ddl, `"preferences" JSONB DEFAULT '{"theme":"light"}'::jsonb`);
});

Deno.test("entityToDDL skips entities without table flag", () => {
  const viewEntity = defineEntity({
    name: "UserView",
    columns: {
      id: { type: "string" },
    },
  });

  assertEquals(entityToDDL(viewEntity), "-- Entity UserView is not mapped to a table.");
});
