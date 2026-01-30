import { assert, assertEquals, assertThrows } from "std/assert";
import { defineEntity, type EntityConfig } from "../index.ts";
import { z } from "zod";
import type { ZodType } from "../utils/zod.ts";

/**
 * Internal Zod definition structure (for accessing _zod.def).
 * This is used to access Zod's internal API which is not part of the public types.
 */
interface ZodInternalDef {
  type: string;
  shape?: Record<string, ZodType>;
}

/**
 * Helper type for accessing Zod's internal _zod property.
 * Uses unknown instead of any for type safety.
 */
type ZodWithInternal = {
  _zod: {
    def: ZodInternalDef;
  };
} & ZodType;

Deno.test("defineEntity validates PascalCase names", () => {
  const config: EntityConfig = {
    name: "user",
    fields: {
      id: { validator: z.string() },
    },
  };

  assertThrows(() => defineEntity(config), Error, "PascalCase");
});

Deno.test("defineEntity deeply freezes the entity runtime", () => {
  const entity = defineEntity({
    name: "Person",
    table: true,
    fields: {
      id: { validator: z.string() },
      createdAt: { validator: z.date() },
    },
  });

  assert(Object.isFrozen(entity));
  assert(Object.isFrozen(entity.fields));

  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    (entity as any).name = "Another";
  });

  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    (entity.fields as any).id = { validator: z.number() };
  });
});

Deno.test("defineEntity keeps field metadata", () => {
  const entity = defineEntity({
    name: "Article",
    table: true,
    fields: {
      id: { validator: z.string() },
      title: { validator: z.string(), description: "Article title" },
      tags: { validator: z.array(z.string()).optional() },
    },
    doc: true,
    test: "smoke",
  });

  const tagsValidator = entity.fields.tags?.validator as unknown as ZodWithInternal;
  assertEquals(tagsValidator?._zod.def.type, "optional");
  assertEquals(entity.test, "smoke");
});

Deno.test("defineEntity generates schema from fields", () => {
  const entity = defineEntity({
    name: "Test",
    fields: {
      id: { validator: z.uuid() },
      email: { validator: z.string().email() },
    },
  });

  assert(entity.schema);
  const schemaWithInternal = entity.schema as unknown as ZodWithInternal;
  assert(schemaWithInternal._zod.def.type === "object");
});

Deno.test("defineEntity generates public schema with visibility filtering", () => {
  const entity = defineEntity({
    name: "Test",
    fields: {
      id: { validator: z.uuid(), visibility: "public" },
      email: { validator: z.string().email(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret" },
      internal: { validator: z.string(), visibility: "internal" },
    },
  });

  assert(entity.public);
  const publicWithInternal = entity.public as unknown as ZodWithInternal;
  const publicShape = publicWithInternal._zod.def.shape;
  assert(publicShape);
  assert("id" in publicShape);
  assert("email" in publicShape);
  assert(!("password" in publicShape));
  assert(!("internal" in publicShape));
});

Deno.test("defineEntity generates input schemas", () => {
  const entity = defineEntity({
    name: "Test",
    fields: {
      id: { validator: z.uuid(), immutable: true },
      email: { validator: z.email() },
      createdAt: { validator: z.date(), db: { defaultNow: true } },
    },
  });

  assert(entity.input.create);
  assert(entity.input.update);

  // input.create should omit id and createdAt
  const createWithInternal = entity.input.create as unknown as ZodWithInternal;
  const createShape = createWithInternal._zod.def.shape;
  assert(createShape);
  assert(!("id" in createShape));
  assert(!("createdAt" in createShape));
  assert("email" in createShape);

  // input.update should be partial and omit id and createdAt
  const updateWithInternal = entity.input.update as unknown as ZodWithInternal;
  const updateShape = updateWithInternal._zod.def.shape;
  assert(updateShape);
  assert(!("id" in updateShape));
  assert(!("createdAt" in updateShape));
});

Deno.test("defineEntity generates CRUD actions when table is true", () => {
  const entity = defineEntity({
    name: "Test",
    table: true,
    fields: {
      id: { validator: z.string() },
    },
  });

  assert(entity.actions);
  assert("create" in entity.actions);
  assert("read" in entity.actions);
  assert("update" in entity.actions);
  assert("delete" in entity.actions);
  assert("list" in entity.actions);
});

Deno.test("defineEntity exposes fields for metadata access", () => {
  const entity = defineEntity({
    name: "Test",
    fields: {
      id: { validator: z.string(), db: { primary: true } },
      email: { validator: z.string().email(), visibility: "public" },
      password: { validator: z.string(), visibility: "secret", stored: true },
      computed: { validator: z.string(), stored: false },
    },
  });

  assert(entity.fields);
  assertEquals(entity.fields.id.db?.primary, true);
  assertEquals(entity.fields.email.visibility, "public");
  assertEquals(entity.fields.password.visibility, "secret");
  assertEquals(entity.fields.computed.stored, false);
});
