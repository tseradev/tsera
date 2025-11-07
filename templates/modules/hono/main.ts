import { Hono } from "./deps/hono.ts";
import registerHealthRoutes from "./routes/health.ts";

// Initialize secrets if available
try {
  await import("./lib/env.ts");
} catch {
  // Secrets module not enabled, will use Deno.env
}

export const app = new Hono();

registerHealthRoutes(app);

if (import.meta.main) {
  // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env
  const port = (globalThis.tsera?.env("PORT") as number) ??
    Number(Deno.env.get("PORT") ?? 8000);
  console.log(`Listening on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
