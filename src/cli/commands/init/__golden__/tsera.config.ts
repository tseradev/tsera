import { TseraConfig } from "tsera/cli/contracts/types.ts";

// TSera configuration (full profile with comments).
const config: TseraConfig = {
  // Toggle generated artifacts controlled by "tsera dev".
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  // Folder storing generated schemas, manifests, and OpenAPI files.
  outDir: ".tsera",
  // Source folders scanned for entities (add files or globs as needed).
  paths: {
    entities: ["domain"],
    // routes: ["routes/**/*.ts"],
  },
  db: {
    // Choose between "postgres", "mysql", or "sqlite".
    dialect: "postgres",
    // Environment variable supplying the connection URL.
    urlEnv: "TSERA_DATABASE_URL",
    ssl: "prefer",
    // Example SQLite configuration:
    // dialect: "sqlite",
    // file: "data/tsera.sqlite",
  },
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "main.ts",
    envFile: ".env.deploy",
  },
  modules: {
    hono: true,
    fresh: true,
    docker: true,
    ci: true,
    secrets: true,
  },
};

export default config;
