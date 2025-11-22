import { assertEquals } from "std/assert";
import { defineEntity, getEntitySchema } from "../index.ts";
import { z } from "zod";

const postEntity = defineEntity({
  name: "Post",
  table: true,
  fields: {
    id: { validator: z.string() },
    title: { validator: z.string() },
    publishedAt: { validator: z.date().nullable() },
    views: { validator: z.number().default(0).optional() },
    tags: { validator: z.array(z.string()).optional() },
    metadata: { validator: z.any().default({ featured: false }).optional() },
  },
});

Deno.test("getEntitySchema returns the entity schema", () => {
  const schema = getEntitySchema(postEntity);

  const parsed = schema.parse({
    id: "post_1",
    title: "Hello",
    publishedAt: null,
    tags: ["deno"],
  });

  assertEquals(parsed.id, "post_1");
  assertEquals(parsed.views, 0);
  assertEquals(parsed.metadata, { featured: false });
});

Deno.test("getEntitySchema enforces required fields", () => {
  const schema = getEntitySchema(postEntity);
  const result = schema.safeParse({
    title: "Missing id",
  });

  assertEquals(result.success, false);
});
