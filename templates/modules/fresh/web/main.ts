#!/usr/bin/env -S deno run -A --watch=static/,routes/

import { Builder } from "jsr:@fresh/core@2";
import { type Plugin } from "jsr:@fresh/core@2/plugin";

// Import routes
import * as home from "./routes/index.tsx";

const builder = new Builder();

// Register routes
builder.page("/", home);

// Build and start
const built = builder.build();

if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  console.log(`Fresh server listening on http://localhost:${port}`);
  
  Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      console.log(`Listening on http://${hostname}:${port}`);
    },
  }, built.handler);
}

export default built;

