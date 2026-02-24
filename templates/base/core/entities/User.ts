import { defineEntity, z } from "@tsera/core";

export const User = defineEntity({
  // === METADATA / GLOBAL BEHAVIOR ===

  name: "User", // Logical name of the entity (required)

  table: true, // Generate table + migrations (Drizzle)
  schema: true, // Generate Zod schemas + types + OpenAPI
  doc: true, // Generate documentation (Markdown / site / CLI)
  test: "smoke", // false | "smoke" | "full"
  active: true, // If false: entity ignored by pipelines

  // === FIELD DEFINITIONS ===

  fields: {
    id: {
      validator: z.uuid(),
      visibility: "public",
      immutable: true,
      description: "Unique identifier for the user.",
      example: "b1c2d3e4-f5a6-7890-1234-56789abcdef0",
      db: {
        primary: true,
      },
    },

    email: {
      validator: z.string().email(),
      visibility: "public",
      description: "User email address, expected to be unique.",
      example: "user@example.com",
      db: {
        unique: true,
        index: true,
      },
    },

    displayName: {
      validator: z.string().min(1).max(100).optional(),
      visibility: "public",
      description: "Optional display name.",
      example: "John Doe",
    },

    password: {
      validator: z.string().min(8),
      visibility: "secret", // 🔐 never exposed in User.public and masked in logs/docs/tests
      description: "Hashed password.",
    },

    createdAt: {
      validator: z.date(),
      visibility: "internal",
      immutable: true,
      description: "Creation date.",
      db: {
        defaultNow: true,
      },
    },
  },

  // === ADVANCED OPTIONAL BLOCKS ===

  // relations: (r) => ({
  //   posts: r.oneToMany("Post", {
  //     foreignKey: "authorId",
  //     onDelete: "cascade",
  //   }),
  // }),

  openapi: {
    enabled: true,
    tags: ["users", "auth"],
    summary: "User accounts management",
    description: "Entity representing an application user.",
  },

  docs: {
    description: "Business user of the platform.",
    examples: {
      public: {
        minimal: {
          id: "b1c2d3e4-f5a6-7890-1234-56789abcdef0",
          email: "user@example.com",
        },
      },
    },
  },
  // actions: (a) => ({
  //   create: a.create(),
  //   update: a.update(),
  //   delete: a.delete(),
  //   list: a.list(),
  // }),
});

export default User;
