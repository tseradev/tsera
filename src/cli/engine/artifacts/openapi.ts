/**
 * Placeholder artifact generator for OpenAPI documents.
 */

import type { OpenAPIDocument } from "../../../core/openapi.ts";

export async function emitOpenAPIDocument(doc: OpenAPIDocument): Promise<void> {
  await Promise.resolve();
  console.log(`Génération OpenAPI (placeholder): ${doc.info.title}@${doc.info.version}`);
}
