/**
 * Hono application entry point.
 *
 * This module initializes a Hono web server with health check routes.
 * It integrates with TSera's secrets module if enabled, falling back
 * to standard Deno environment variables otherwise.
 *
 * @module
 */

import { Hono } from "hono";
import registerHealthRoutes from "./routes/health.ts";

/**
 * Hono application instance with registered routes.
 */
export const app = new Hono();

// Register health routes
registerHealthRoutes(app);

// Start server when run directly
if (import.meta.main) {
  // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env
  const tseraEnv = resolveTseraEnv();
  const tseraPort = tseraEnv ? tseraEnv.env("PORT") : undefined;
  const envPort = Deno.env.get("PORT");
  const port = readPort(tseraPort) ?? readPort(envPort) ?? 8000;
  console.log(`Listening on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}

type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

function resolveTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["tsera"];
  if (!isTseraEnvAccessor(tsera)) {
    return undefined;
  }
  return tsera;
}

function readPort(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isTseraEnvAccessor(value: unknown): value is TseraEnvAccessor {
  return isRecord(value) && typeof value["env"] === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
