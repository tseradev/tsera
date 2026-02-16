import { count } from "drizzle-orm";
import type { Context, Hono } from "hono";
import { db, slogans } from "../../db/connect.ts";

/**
 * Health check response types.
 */
type HealthResponseOk = {
  status: "ok";
};

type HealthResponseDown = {
  status: "down";
};

type HealthResponse = HealthResponseOk | HealthResponseDown;

/**
 * Registers health check routes on the provided Hono app instance.
 *
 * Adds a GET `/api/v1/health` endpoint that checks:
 * - Server is running
 * - Database connection is available
 *
 * Returns:
 * - 200 OK with { "status": "ok" } if all checks pass
 * - 503 Service Unavailable with { "status": "down" } if database is unavailable
 *
 * @param app - The Hono application instance to register routes on
 * @returns The same Hono instance (for chaining)
 */
export default function registerHealthRoutes(app: Hono): Hono {
  app.get("/api/v1/health", async (c: Context) => {
    try {
      // Check if database is available
      if (!db) {
        const response: HealthResponseDown = { status: "down" };
        return c.json(response, 503);
      }

      // Perform a minimal database query to verify connectivity
      // Using count on slogans table as a lightweight health check
      const result = await db.select({ count: count() }).from(slogans);

      // If we got a result, database is healthy
      const response: HealthResponseOk = { status: "ok" };
      return c.json(response, 200);
    } catch (error) {
      // Log the error for debugging
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Health check failed:", errorMessage);

      // Return 503 Service Unavailable
      const response: HealthResponseDown = { status: "down" };
      return c.json(response, 503);
    }
  });

  return app;
}
