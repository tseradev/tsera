import { assertEquals } from "../testing/asserts.ts";
import { defineEntity, entityToZod } from "./index.ts";

const postEntity = defineEntity({
  name: "Post",
  table: true,
  columns: {
    id: { type: "string" },
    title: { type: "string" },
    publishedAt: { type: "date", nullable: true },
    views: { type: "number", optional: true, default: 0 },
    tags: { type: { arrayOf: "string" }, optional: true },
    metadata: { type: "json", optional: true, default: { featured: false } },
  },
});

Deno.test("entityToZod maps entity columns to Zod schema", () => {
  const schema = entityToZod(postEntity);

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

Deno.test("entityToZod enforces required fields", () => {
  const schema = entityToZod(postEntity);
  const result = schema.safeParse({
    title: "Missing id",
  });

  assertEquals(result.success, false);
});
