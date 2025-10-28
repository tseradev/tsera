import type { Manifest } from "@fresh/server";
import config from "./fresh.config.ts";
import * as $0 from "./routes/index.tsx";

const manifest: Manifest = {
  routes: {
    "./routes/index.tsx": $0,
  },
  islands: {},
  baseUrl: import.meta.url,
  config,
};

export default manifest;
