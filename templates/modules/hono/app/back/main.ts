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
  const tseraPort = globalThis.tsera?.env("PORT");
  const envPort = Deno.env.get("PORT");
  const port = typeof tseraPort === "number" ? tseraPort
    : envPort ? Number(envPort)
      : 8000;
  console.log(`Listening on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
