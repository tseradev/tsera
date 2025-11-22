import { assert, assertEquals } from "std/assert";
import { defineEntity, generateOpenAPIDocument } from "../index.ts";
import { z } from "zod";

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
  // Le schéma OpenAPI ne doit contenir que les champs visibility === "public"
  const commentSchema = document.components?.schemas?.Comment;
  assert(commentSchema.properties);
  assert("id" in commentSchema.properties);
  assert("body" in commentSchema.properties);
  // createdAt ne doit pas être dans OpenAPI (visibility: "internal")
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
