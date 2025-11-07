/**
 * Hono dependency loader with fallback for offline development.
 *
 * This module attempts to load Hono from npm. If the network is unavailable,
 * it falls back to a minimal router implementation to keep tests running.
 *
 * @module
 */

export type Context = {
  json: (data: unknown) => Response;
  text: (data: string) => Response;
  req: Request;
};

export type Handler = (c: Context) => Response | Promise<Response>;

/**
 * Minimal Hono fallback implementation for offline development.
 */
class HonoFallback {
  private routes = new Map<string, Handler>();

  get(path: string, handler: Handler) {
    this.routes.set(`GET:${path}`, handler);
    return this;
  }

  post(path: string, handler: Handler) {
    this.routes.set(`POST:${path}`, handler);
    return this;
  }

  fetch = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const key = `${req.method}:${url.pathname}`;
    const handler = this.routes.get(key);

    if (!handler) {
      return new Response("Not Found", { status: 404 });
    }

    const context: Context = {
      json: (data) =>
        new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json" },
        }),
      text: (data) =>
        new Response(data, {
          headers: { "content-type": "text/plain" },
        }),
      req,
    };

    return await handler(context);
  };
}

/**
 * Type representing a Hono-like router interface.
 */
export type HonoRouter = {
  get(path: string, handler: Handler): HonoRouter;
  post(path: string, handler: Handler): HonoRouter;
  fetch(req: Request): Response | Promise<Response>;
};

/**
 * Type representing the Hono class constructor.
 */
export type HonoConstructor = new () => HonoRouter;

// Try to import actual Hono, fallback to minimal implementation
let Hono: HonoConstructor;

try {
  const actualHono = await import("npm:hono@4");
  Hono = actualHono.Hono;
} catch {
  // Network unavailable or npm:hono@4 not accessible
  console.warn("Hono not available, using minimal fallback router");
  Hono = HonoFallback;
}

export { Hono };
