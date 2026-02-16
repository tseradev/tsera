// NOTE: Ces imports relatifs pointent vers le code source du CLI TSera.
// Dans un projet généré, ces imports seront remplacés par des imports JSR
// (ex: import { defineEntity, z } from "tsera/core";)
// Une fois TSera publié sur JSR, ce problème sera résolu automatiquement.
import { defineEntity } from "../../../../src/core/entity.ts";
import { z } from "../../../../src/core/utils/zod.ts";

export const Slogan = defineEntity({
  // === MÉTADONNÉES / COMPORTEMENT GLOBAL ===

  name: "Slogan", // Nom logique de l'entité (obligatoire)

  table: true, // Génère table + migrations (Drizzle)
  schema: true, // Génère schémas Zod + types + OpenAPI
  doc: true, // Génère documentation (Markdown / site / CLI)
  test: "smoke", // false | "smoke" | "full"
  active: true, // Si false : entité ignorée par les pipelines

  // === DÉFINITION DES CHAMPS ===

  fields: {
    id: {
      validator: z.number().int().positive(),
      visibility: "public",
      immutable: true,
      description: "Identifiant unique du slogan.",
      example: 1,
      db: {
        primary: true,
      },
    },

    text: {
      validator: z.string().min(1).max(500),
      visibility: "public",
      description: "Texte du slogan.",
      example: "Minimal by design.",
    },
  },

  // === BLOCS OPTIONNELS AVANCÉS ===

  openapi: {
    enabled: true,
    tags: ["slogans"],
    summary: "Slogans management",
    description: "Entité représentant un slogan affiché sur le frontend.",
  },

  docs: {
    description: "Slogan affiché sur la page d'accueil du frontend Lume.",
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
