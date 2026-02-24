// NOTE: Ces imports relatifs pointent vers le code source du CLI TSera.
// Dans un projet généré, ces imports seront remplacés par des imports JSR
// (ex: import { defineEntity, z } from "@tsera/core";)
// Une fois TSera publié sur JSR, ce problème sera résolu automatiquement.
import { defineEntity } from "../../../../src/core/entity.ts";
import { z } from "../../../../src/core/utils/zod.ts";

export const User = defineEntity({
  // === MÉTADONNÉES / COMPORTEMENT GLOBAL ===

  name: "User", // Nom logique de l'entité (obligatoire)

  table: true, // Génère table + migrations (Drizzle)
  schema: true, // Génère schémas Zod + types + OpenAPI
  doc: true, // Génère documentation (Markdown / site / CLI)
  test: "smoke", // false | "smoke" | "full"
  active: true, // Si false : entité ignorée par les pipelines

  // === DÉFINITION DES CHAMPS ===

  fields: {
    id: {
      validator: z.uuid(),
      visibility: "public",
      immutable: true,
      description: "Identifiant unique de l'utilisateur.",
      example: "b1c2d3e4-f5a6-7890-1234-56789abcdef0",
      db: {
        primary: true,
      },
    },

    email: {
      validator: z.string().email(),
      visibility: "public",
      description: "Adresse e-mail de l'utilisateur, supposée unique.",
      example: "user@example.com",
      db: {
        unique: true,
        index: true,
      },
    },

    displayName: {
      validator: z.string().min(1).max(100).optional(),
      visibility: "public",
      description: "Nom d'affichage optionnel.",
      example: "John Doe",
    },

    motDePasse: {
      validator: z.string().min(8),
      visibility: "secret", // 🔐 jamais exposé dans User.public et masqué dans logs/docs/tests
      description: "Mot de passe hashé.",
    },

    createdAt: {
      validator: z.date(),
      visibility: "internal",
      immutable: true,
      description: "Date de création.",
      db: {
        defaultNow: true,
      },
    },
  },

  // === BLOCS OPTIONNELS AVANCÉS ===

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
    description: "Entité représentant un utilisateur applicatif.",
  },

  docs: {
    description: "Utilisateur métier de la plateforme.",
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
