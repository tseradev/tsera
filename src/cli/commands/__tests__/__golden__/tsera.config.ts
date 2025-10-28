// deno-lint-ignore-file no-unversioned-import
// tsera.config.ts — full profile (toggle true/false as needed)
import type { TseraConfig } from "jsr:@tsera/core";

const config: TseraConfig = {
  // GENERATION
  openapi: true, // Generate openapi.json
  docs: true, // Markdown docs + Swagger UI
  tests: true, // Auto-generated smoke tests
  telemetry: false, // Anonymous DX telemetry

  // OUTPUT
  outDir: ".tsera",
  paths: {
    entities: ["./domain/**/*.entity.ts"],
    routes: ["./app/**/*.route.ts"],
  },

  // DATABASE
  db: {
    dialect: "postgres", // "postgres"|"mysql"|"sqlite"
    urlEnv: "DATABASE_URL", // Environment variable name
    ssl: "require", // Postgres: "disable"|"prefer"|"require"
    // file: "./data/app.db", // Required when dialect = "sqlite"
  },

  // DEPLOYMENT
  deploy: {
    target: "deno_deploy", // "deno_deploy"|"cloudflare"|"node_pm2"
    entry: "./main.ts", // Application entry point
    envFile: ".env", // Local env file
  },
};

export default config;
