
import { defineEntity } from "tsera/core/entity.ts";

export const UserEntity = defineEntity({
  name: "User",
  table: true,
  doc: true,
  test: "smoke",
  columns: {
    id: {
      type: "string",
      description: "Unique identifier generated on the client or by TSera.",
    },
    email: {
      type: "string",
      description: "User email address, expected to be unique.",
    },
    displayName: {
      type: "string",
      optional: true,
      description: "Optional display name.",
    },
    isActive: {
      type: "boolean",
      default: true,
      description: "Logical activation flag.",
    },
    createdAt: {
      type: "date",
      default: "1970-01-01T00:00:00.000Z",
      description: "ISO creation timestamp.",
    },
    settings: {
      type: { arrayOf: "json" },
      optional: true,
      description: "Array of JSON configuration objects.",
    },
  },
});

export default UserEntity;
