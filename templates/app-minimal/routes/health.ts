import type { Hono } from "hono";

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export default function registerHealthRoutes(app: Hono) {
  app.get("/health", (ctx) => {
    const payload: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    return ctx.json(payload);
  });
}
