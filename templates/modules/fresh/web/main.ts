#!/usr/bin/env -S deno run -A --watch=static/,routes/

/**
 * Fresh application entry point.
 *
 * This module initializes the Fresh web framework with file-based routing.
 * It automatically discovers routes from the `routes/` directory and islands
 * from the `islands/` directory.
 *
 * The application integrates with TSera's secrets module if enabled, falling
 * back to standard Deno environment variables otherwise.
 *
 * @module
 */

import { App } from "jsr:@fresh/core@2";
import { dirname, fromFileUrl } from "jsr:@std/path@1";

// Initialize secrets if available
try {
  await import("../../secrets/lib/env.ts");
} catch {
  // Secrets module not enabled, will use Deno.env
}

// Get the directory of this module
const baseDir = dirname(fromFileUrl(import.meta.url));

// Fresh App with file-based routing
const app = new App();
app.fsRoutes(baseDir);

if (import.meta.main) {
  // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env
  const port =
    (globalThis as { tsera?: { env: (key: string) => unknown } }).tsera?.env("FRESH_PORT") as number ??
    Number(Deno.env.get("PORT") ?? 8000);
  console.log(`Fresh server listening on http://localhost:${port}`);

  await app.listen({ port });
}

export default app;
