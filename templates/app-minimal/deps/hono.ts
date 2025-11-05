export interface RouteContext {
  req: Request;
  json<T>(body: T, status?: number): Response;
}

export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;

export interface HonoLike {
  get(path: string, handler: RouteHandler): this;
  fetch(request: Request): Promise<Response>;
  request(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

type HonoConstructor = new () => HonoLike;

class FallbackHono implements HonoLike {
  #routes = new Map<string, RouteHandler>();

  get(path: string, handler: RouteHandler): this {
    const key = this.#key("GET", path);
    this.#routes.set(key, handler);
    return this;
  }

  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const key = `${request.method.toUpperCase()} ${url.pathname}`;
    const handler = this.#routes.get(key);
    if (!handler) {
      return new Response("Not Found", { status: 404 });
    }
    const context: RouteContext = {
      req: request,
      json: (body, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    };
    const result = await handler(context);
    return result instanceof Response ? result : context.json(result);
  };

  request = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    if (input instanceof Request) {
      return await this.fetch(input);
    }
    const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input);
    return await this.fetch(new Request(url, init));
  };

  #key(method: string, path: string): string {
    const normalised = path.startsWith("/") ? path : `/${path}`;
    return `${method.toUpperCase()} ${normalised}`;
  }
}

async function loadHono(): Promise<HonoConstructor> {
  try {
    const mod = await import("npm:hono@4");
    if (typeof mod?.Hono === "function") {
      return mod.Hono as unknown as HonoConstructor;
    }
  } catch {
    // Ignore network or resolution errors and fall back to the lightweight implementation.
  }
  return FallbackHono;
}

const HonoResolved: HonoConstructor = await loadHono();

export const Hono: HonoConstructor = HonoResolved;
export type HonoInstance = HonoLike;
