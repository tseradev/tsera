import { assert, assertEquals, assertThrows } from "../testing/asserts.ts";
import { defineEntity, type EntitySpec } from "./index.ts";

Deno.test("defineEntity validates PascalCase names", () => {
  const spec: EntitySpec = {
    name: "user",
    columns: {
      id: { type: "string" },
    },
  };

  assertThrows(() => defineEntity(spec), Error, "PascalCase");
});

Deno.test("defineEntity deeply freezes the entity definition", () => {
  const entity = defineEntity({
    name: "Person",
    table: true,
    columns: {
      id: { type: "string" },
      createdAt: { type: "date", nullable: false },
    },
  });

  assert(Object.isFrozen(entity));
  assert(Object.isFrozen(entity.columns));

  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    (entity as any).name = "Another";
  });

  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    (entity.columns as any).id = { type: "number" };
  });
});

Deno.test("defineEntity keeps column metadata", () => {
  const entity = defineEntity({
    name: "Article",
    table: true,
    columns: {
      id: { type: "string" },
      title: { type: "string", description: "Article title" },
      tags: { type: { arrayOf: "string" }, optional: true },
    },
    doc: true,
    test: "smoke",
  });

  assertEquals(entity.columns.tags.optional, true);
  assertEquals(entity.test, "smoke");
});
