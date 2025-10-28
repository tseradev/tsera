import type { EntityDef } from "./entity.ts";
import { entityToZod } from "./schema.ts";
import { z } from "./utils/zod.ts";

import type * as FallbackModule from "../deps/polyfills/zod-to-openapi.ts";

export type {
  OpenAPIDocumentOptions,
  OpenAPIObject,
  SchemaObject,
} from "../deps/polyfills/zod-to-openapi.ts";

type ActualZodToOpenAPIModule = {
  extendZodWithOpenApi: (zMod: unknown) => void;
  OpenAPIGenerator: new (
    schemas: { ref: string; schema: unknown }[],
    version?: string,
  ) => { generateDocument: (base: unknown) => unknown };
};

type Fallback = typeof FallbackModule;

let actualModule: ActualZodToOpenAPIModule | null = null;
let fallbackModule: Fallback | null = null;

try {
  const mod = await import("npm:@asteasolutions/zod-to-openapi@6.2.0");
  (mod as ActualZodToOpenAPIModule).extendZodWithOpenApi(z);
  actualModule = mod as ActualZodToOpenAPIModule;
} catch {
  fallbackModule = await import("../deps/polyfills/zod-to-openapi.ts");
}

if (!actualModule && !fallbackModule) {
  fallbackModule = await import("../deps/polyfills/zod-to-openapi.ts");
}

export function generateOpenAPIDocument(
  entities: readonly EntityDef[],
  options: FallbackModule.OpenAPIDocumentOptions,
): FallbackModule.OpenAPIObject {
  if (actualModule) {
    return generateWithActual(entities, options, actualModule) as FallbackModule.OpenAPIObject;
  }
  return fallbackModule!.generateOpenAPIDocument(entities, options);
}

function generateWithActual(
  entities: readonly EntityDef[],
  options: FallbackModule.OpenAPIDocumentOptions,
  mod: ActualZodToOpenAPIModule,
): unknown {
  const schemas = entities.map((entity) => {
    const zodSchema = entityToZod(entity);
    const schemaWithOpenApi = zodSchema as unknown as {
      openapi?: (config: { refId: string }) => unknown;
    };
    const extended = typeof schemaWithOpenApi.openapi === "function"
      ? schemaWithOpenApi.openapi({ refId: entity.name })
      : zodSchema;
    return { ref: entity.name, schema: extended };
  });

  const generator = new mod.OpenAPIGenerator(schemas, "3.1.0");
  const document = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths: {},
    components: { schemas: {} },
  });

  return document;
}
