import type { Context, HonoRouter } from "../deps/hono.ts";

/**
 * Registers health check routes on the provided Hono app instance.
 * @param app The Hono application instance.
 */
export default function registerHealthRoutes(app: HonoRouter) {
  app.get("/health", (c: Context) => c.json({ status: "ok" }));
}
