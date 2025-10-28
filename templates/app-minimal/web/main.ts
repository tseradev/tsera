import { start } from "@fresh/server";
import manifest from "./fresh.gen.ts";

if (import.meta.main) {
  await start(manifest, { port: 8001 });
}
