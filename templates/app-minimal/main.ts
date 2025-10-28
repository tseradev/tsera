import { Hono } from "./deps/hono.ts";
import registerHealthRoutes from "./app/routes/health.route.ts";

export const app = new Hono();

registerHealthRoutes(app);

if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  console.log(`Listening on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
