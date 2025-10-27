import { assert, assertEquals } from "./helpers/asserts.ts";
import { defineEntity, entityToOpenAPI } from "../index.ts";

const commentEntity = defineEntity({
  name: "Comment",
  table: true,
  columns: {
    id: { type: "string" },
    body: { type: "string", description: "Comment body" },
    createdAt: { type: "date" },
  },
  doc: true,
});

Deno.test("entityToOpenAPI generates a document containing the entity schema", () => {
  const document = entityToOpenAPI(commentEntity, {
    title: "Comment API",
    version: "1.0.0",
  });

  assertEquals(document.info.title, "Comment API");
  assert(document.components?.schemas?.Comment);
  assertEquals(document.components?.schemas?.Comment.description, "Comment entity");
});
