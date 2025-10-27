/**
 * Lightweight OpenAPI bridge placeholder. Future iterations will integrate
 * `zod-to-openapi` once the schema output becomes stable.
 */

import type { ZodSchemaLike } from "./schema.ts";

export interface OpenAPIDocument {
  openapi: "3.1.0";
  info: { title: string; version: string };
  components: Record<string, unknown>;
}

export function zodToOpenAPI(
  schema: ZodSchemaLike,
  info: { title: string; version: string },
): OpenAPIDocument {
  return {
    openapi: "3.1.0",
    info,
    components: {
      schemas: schema.shape,
    },
  };
}
