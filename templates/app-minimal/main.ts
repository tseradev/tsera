import { Hono } from "hono";
import registerHealthRoutes from "./routes/health.ts";

const app = new Hono();

registerHealthRoutes(app);

const port = Number(Deno.env.get("PORT") ?? 8000);

console.log(`Listening on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
