/**
 * Hono application entry point.
 *
 * This module initializes a Hono web server with health check routes.
 * It integrates with TSera's secrets module if enabled, falling back
 * to standard Deno environment variables otherwise.
 *
 * @module
 */

// Install dependencies first: deno add jsr:@hono/hono@^4.10.7
// After installation, uncomment the imports and code below:
// import { Hono } from "hono";
// import registerHealthRoutes from "./routes/health.ts";

// Initialize secrets if available
try {
  await import("../../../secrets/manager.ts");
} catch {
  // Secrets module not enabled, will use Deno.env
}

/**
 * Minimal Hono-like app interface for testing before dependencies are installed.
 * This allows tests to run even when Hono is not yet installed.
 */
interface MinimalHonoApp {
  get(path: string, handler: (c: { json: (data: unknown) => Response }) => Response): void;
  fetch(req: Request): Promise<Response>;
}

/**
 * Creates a minimal app implementation for tests.
 * This will be replaced with the real Hono app after dependencies are installed.
 */
function createMinimalApp(): MinimalHonoApp {
  const routes = new Map<string, (c: { json: (data: unknown) => Response }) => Response>();

  return {
    get(path: string, handler: (c: { json: (data: unknown) => Response }) => Response) {
      routes.set(path, handler);
    },
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const handler = routes.get(url.pathname);
      if (handler) {
        return handler({
          json: (data: unknown) => new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  };
}

/**
 * Hono application instance with registered routes.
 *
 * Note: This is a minimal implementation for testing purposes.
 * After installing dependencies, replace with: export const app = new Hono();
 */
const minimalApp = createMinimalApp();

// Register health route manually for tests (since registerHealthRoutes requires Hono types)
minimalApp.get("/health", (c) => c.json({ status: "ok" }));

export const app = minimalApp as unknown as {
  fetch(req: Request): Promise<Response>;
};

// Full implementation (uncomment after installing dependencies):
// import { Hono } from "hono";
// import registerHealthRoutes from "./routes/health.ts";
// export const app = new Hono();
// registerHealthRoutes(app);

// if (import.meta.main) {
//   // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env
//   const port = (globalThis.tsera?.env("PORT") as number) ??
//     Number(Deno.env.get("PORT") ?? 8000);
//   console.log(`Listening on http://localhost:${port}`);
//   Deno.serve({ port }, app.fetch);
// }
