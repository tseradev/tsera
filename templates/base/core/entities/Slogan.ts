import { defineEntity, z } from "@tsera/core";

export const Slogan = defineEntity({
  // === METADATA / GLOBAL BEHAVIOR ===

  name: "Slogan", // Logical name of the entity (required)

  table: true, // Generate table + migrations (Drizzle)
  schema: true, // Generate Zod schemas + types + OpenAPI
  doc: true, // Generate documentation (Markdown / site / CLI)
  test: "smoke", // false | "smoke" | "full"
  active: true, // If false: entity ignored by pipelines

  // === FIELD DEFINITIONS ===

  fields: {
    id: {
      validator: z.number().int().positive(),
      visibility: "public",
      immutable: true,
      description: "Unique identifier for the slogan.",
      example: 1,
      db: {
        primary: true,
      },
    },

    text: {
      validator: z.string().min(1).max(500),
      visibility: "public",
      description: "The slogan text.",
      example: "Minimal by design.",
    },
  },

  // === ADVANCED OPTIONAL BLOCKS ===

  openapi: {
    enabled: true,
    tags: ["slogans"],
    summary: "Slogans management",
    description: "Entity representing a slogan displayed on the frontend.",
  },

  docs: {
    description: "Slogan displayed on the Lume frontend homepage.",
    examples: {
      public: {
        minimal: {
          id: 1,
          text: "Minimal by design.",
        },
        complete: {
          id: 2,
          text: "Scalable by default.",
        },
      },
    },
  },
});

export default Slogan;
