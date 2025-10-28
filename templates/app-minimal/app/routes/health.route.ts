import type { HonoInstance, RouteContext } from "../../deps/hono.ts";

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export default function registerHealthRoutes(app: HonoInstance) {
  app.get("/health", (ctx: RouteContext) => {
    const payload: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    return ctx.json(payload);
  });
}
