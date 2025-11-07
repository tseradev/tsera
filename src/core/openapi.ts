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

/**
 * Type guard verifying whether a value represents the actual zod-to-openapi module.
 *
 * @param value - Value to inspect.
 * @returns {@code true} if the value is the actual module; otherwise {@code false}.
 */
function isActualModule(value: unknown): value is ActualZodToOpenAPIModule {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.extendZodWithOpenApi === "function" &&
    typeof record.OpenAPIGenerator === "function";
}

/**
 * Attempts to resolve the actual zod-to-openapi module from an imported value.
 *
 * @param mod - Imported module value to inspect.
 * @returns The actual module if found; otherwise {@code null}.
 */
function resolveActualModule(mod: unknown): ActualZodToOpenAPIModule | null {
  if (isActualModule(mod)) {
    return mod;
  }
  if (mod && typeof mod === "object" && "default" in mod) {
    const candidate = (mod as { default?: unknown }).default;
    if (isActualModule(candidate)) {
      return candidate;
    }
  }
  return null;
}

let actualModule: ActualZodToOpenAPIModule | null = null;
let fallbackModule: Fallback | null = null;

try {
  const mod = await import("npm:@asteasolutions/zod-to-openapi@6.2.0");
  const candidate = resolveActualModule(mod);
  if (candidate) {
    candidate.extendZodWithOpenApi(z);
    actualModule = candidate;
  }
} catch {
  // Ignore and fall back to the polyfill below.
}

if (!actualModule) {
  fallbackModule = await import("../deps/polyfills/zod-to-openapi.ts");
}

/**
 * Generates an OpenAPI 3.1.0 document from a collection of entity definitions.
 *
 * @param entities - Array of validated entity definitions to include in the document.
 * @param options - Configuration options for the OpenAPI document (title, version, description).
 * @returns A complete OpenAPI document object with schemas derived from the entities.
 */
export function generateOpenAPIDocument(
  entities: readonly EntityDef[],
  options: FallbackModule.OpenAPIDocumentOptions,
): FallbackModule.OpenAPIObject {
  if (actualModule) {
    return generateWithActual(entities, options, actualModule) as FallbackModule.OpenAPIObject;
  }
  return fallbackModule!.generateOpenAPIDocument(entities, options);
}

/**
 * Generates an OpenAPI document using the actual zod-to-openapi library.
 *
 * @param entities - Array of entity definitions to convert.
 * @param options - OpenAPI document configuration options.
 * @param mod - The actual zod-to-openapi module instance.
 * @returns Generated OpenAPI document.
 */
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
