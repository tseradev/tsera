import { assertEquals, assertStringIncludes } from "std/assert";
import { defineEntity, entityToDDL } from "../index.ts";
import { z } from "zod";

const userEntity = defineEntity({
  name: "UserAccount",
  table: true,
  fields: {
    id: { validator: z.string(), stored: true },
    email: { validator: z.string().default("anonymous@example.com"), stored: true },
    createdAt: { validator: z.date(), stored: true },
    preferences: { validator: z.any().default({ theme: "light" }), stored: true },
    computed: { validator: z.string(), stored: false }, // Ne doit pas apparaître dans DDL
  },
});

Deno.test("entityToDDL emits a CREATE TABLE statement", () => {
  const ddl = entityToDDL(userEntity);

  assertStringIncludes(ddl, 'CREATE TABLE IF NOT EXISTS "user_account"');
  assertStringIncludes(ddl, '"id" TEXT NOT NULL');
  assertStringIncludes(ddl, "\"email\" TEXT DEFAULT 'anonymous@example.com'");
  assertStringIncludes(ddl, `"preferences" JSONB DEFAULT '{"theme":"light"}'::jsonb`);
  // computed ne doit pas apparaître (stored: false)
  assertEquals(ddl.includes('"computed"'), false);
});

Deno.test("entityToDDL filters stored: false fields", () => {
  const entityWithComputed = defineEntity({
    name: "Test",
    table: true,
    fields: {
      id: { validator: z.string(), stored: true },
      computed: { validator: z.string(), stored: false },
      virtual: { validator: z.number(), stored: false },
    },
  });

  const ddl = entityToDDL(entityWithComputed);
  assertStringIncludes(ddl, '"id"');
  assertEquals(ddl.includes('"computed"'), false);
  assertEquals(ddl.includes('"virtual"'), false);
});

Deno.test("entityToDDL skips entities without table flag", () => {
  const viewEntity = defineEntity({
    name: "UserView",
    fields: {
      id: { validator: z.string() },
    },
  });

  assertEquals(entityToDDL(viewEntity), "-- Entity UserView is not mapped to a table.");
});

Deno.test("entityToDDL handles entities with no stored fields", () => {
  const entityNoStored = defineEntity({
    name: "Virtual",
    table: true,
    fields: {
      computed: { validator: z.string(), stored: false },
    },
  });

  const ddl = entityToDDL(entityNoStored);
  assertStringIncludes(ddl, "has no stored fields");
});
