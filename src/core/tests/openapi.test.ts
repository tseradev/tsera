import { assert, assertEquals } from "std/assert";
import { z } from "zod";
import { defineEntity, generateOpenAPIDocument } from "../index.ts";

const commentEntity = defineEntity({
  name: "Comment",
  table: true,
  fields: {
    id: { validator: z.string(), visibility: "public" },
    body: { validator: z.string(), visibility: "public", description: "Comment body" },
    createdAt: { validator: z.date(), visibility: "internal" },
  },
  doc: true,
});

Deno.test("generateOpenAPIDocument aggregates schemas for all entities", () => {
  const document = generateOpenAPIDocument([commentEntity], {
    title: "Comment API",
    version: "1.0.0",
  });

  assertEquals(document.info.title, "Comment API");
  assert(document.components?.schemas?.Comment);
  // OpenAPI schema should only contain fields with visibility === "public"
  const commentSchema = document.components?.schemas?.Comment;
  assert(commentSchema.properties);
  assert("id" in commentSchema.properties);
  assert("body" in commentSchema.properties);
  // createdAt should not be in OpenAPI (visibility: "internal")
  assert(!("createdAt" in commentSchema.properties));
});

Deno.test("generateOpenAPIDocument filters entities with openapi.enabled === false", () => {
  const hiddenEntity = defineEntity({
    name: "Hidden",
    fields: {
      id: { validator: z.string(), visibility: "public" },
    },
    openapi: { enabled: false },
  });

  const document = generateOpenAPIDocument([commentEntity, hiddenEntity], {
    title: "Test API",
    version: "1.0.0",
  });

  assert(document.components?.schemas?.Comment);
  assert(!document.components?.schemas?.Hidden);
});
