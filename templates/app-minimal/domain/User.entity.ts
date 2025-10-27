import { defineEntity } from "tsera/core/entity.ts";

export const UserEntity = defineEntity({
  name: "User",
  table: true,
  doc: true,
  test: "smoke",
  columns: {
    id: {
      type: "string",
      description: "Identifiant unique généré côté client ou par TSera.",
    },
    email: {
      type: "string",
      description: "Adresse courriel unique de l'utilisateur.",
    },
    displayName: {
      type: "string",
      optional: true,
      description: "Nom d'affichage facultatif.",
    },
    isActive: {
      type: "boolean",
      default: true,
      description: "Statut d'activation logique.",
    },
    createdAt: {
      type: "date",
      default: "1970-01-01T00:00:00.000Z",
      description: "Horodatage ISO de création.",
    },
    settings: {
      type: { arrayOf: "json" },
      optional: true,
      description: "Tableau d'objets de configuration JSON.",
    },
  },
});

export default UserEntity;
