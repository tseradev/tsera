import { defineEntity } from "tsera/core";

const User = defineEntity({
  name: "User",
  table: true,
  columns: {
    id: { type: "string" },
    email: { type: "string" },
    createdAt: { type: "date" },
    active: { type: "boolean", default: true },
  },
  doc: true,
  test: "smoke",
});

export default User;
