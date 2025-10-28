import type { EntityDef } from "./entity.ts";
import { entityToZod } from "./schema.ts";
import {
  OpenAPIGenerator,
  type OpenAPIObject,
  OpenAPIRegistry,
} from "npm:@asteasolutions/zod-to-openapi@7.1.0";

export interface OpenAPIDocumentOptions {
  title: string;
  version: string;
  description?: string;
}

export function generateOpenAPIDocument(
  entities: readonly EntityDef[],
  options: OpenAPIDocumentOptions,
): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  for (const entity of entities) {
    registry.register(entity.name, entityToZod(entity));
  }

  const generator = new OpenAPIGenerator(registry.definitions, {
    sortEnumValuesAlphabetically: true,
  });

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths: {},
  });
}
