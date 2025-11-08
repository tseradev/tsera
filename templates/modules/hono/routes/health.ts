import type { Context, HonoRouter } from "../deps/hono.ts";

/**
 * Registers health check routes on the provided Hono app instance.
 *
 * Adds a GET `/health` endpoint that returns a JSON response with
 * status "ok" to indicate the server is running.
 *
 * @param app - The Hono application instance to register routes on
 * @returns The same HonoRouter instance (for chaining, if supported)
 */
export default function registerHealthRoutes(app: HonoRouter): HonoRouter {
  app.get("/health", (c: Context) => c.json({ status: "ok" }));
  return app;
}
