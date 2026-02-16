import { asc } from "drizzle-orm";
import type { Context, Hono } from "hono";
import { db, slogans } from "../../db/connect.ts";

/**
 * Slogan type from database schema.
 */
type SloganRow = {
  id: number;
  text: string;
};

/**
 * Error response type for API errors.
 */
type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

/**
 * Success response type for slogans list.
 */
type SlogansListResponse = {
  data: Array<{
    id: number;
    text: string;
  }>;
};

/**
 * Creates a standardized error response.
 */
function createErrorResponse(
  code: string,
  message: string,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
    },
  };
}

/**
 * Registers slogan routes on the provided Hono app instance.
 *
 * Adds a GET `/api/v1/slogans` endpoint that returns all slogans
 * sorted by id in ascending order.
 *
 * @param app - The Hono application instance to register routes on
 * @returns The same Hono instance (for chaining)
 */
export default function registerSloganRoutes(app: Hono): Hono {
  app.get("/api/v1/slogans", async (c: Context) => {
    try {
      // Check if database is available
      if (!db) {
        const errorResponse = createErrorResponse(
          "DATABASE_UNAVAILABLE",
          "Database connection is not available",
        );
        return c.json(errorResponse, 503);
      }

      // Fetch all slogans sorted by id ascending
      const allSlogans: SloganRow[] = await db.select().from(slogans).orderBy(asc(slogans.id));

      // Transform to response format
      const response: SlogansListResponse = {
        data: allSlogans.map((slogan: SloganRow) => ({
          id: slogan.id,
          text: slogan.text,
        })),
      };

      return c.json(response, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to fetch slogans:", errorMessage);

      const errorResponse = createErrorResponse(
        "INTERNAL_ERROR",
        errorMessage,
      );
      return c.json(errorResponse, 500);
    }
  });

  return app;
}
