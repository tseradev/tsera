#!/usr/bin/env -S deno run -A --watch=static/,routes/

import { Builder } from "jsr:@fresh/core@2";

// Import routes
import * as home from "./routes/index.tsx";

// Initialize secrets if available
try {
  await import("../../lib/env.ts");
} catch {
  // Secrets module not enabled, will use Deno.env
}

const builder = new Builder();

// Register routes
builder.page("/", home);

// Build and start
const built = builder.build();

if (import.meta.main) {
  // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env
  const port = (globalThis.tsera?.env("FRESH_PORT") as number) ??
    Number(Deno.env.get("PORT") ?? 8000);
  console.log(`Fresh server listening on http://localhost:${port}`);

  Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      console.log(`Listening on http://${hostname}:${port}`);
    },
  }, built.handler);
}

export default built;
