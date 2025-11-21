import type { Context, Hono } from "hono";

/**
 * Registers health check routes on the provided Hono app instance.
 *
 * Adds a GET `/health` endpoint that returns a JSON response with
 * status "ok" to indicate the server is running.
 *
 * @param app - The Hono application instance to register routes on
 * @returns The same Hono instance (for chaining)
 */
export default function registerHealthRoutes(app: Hono): Hono {
  app.get("/health", (c: Context) => c.json({ status: "ok" }));
  return app;
}

