// TSera configuration (full profile with comments).
const config = {
  // Toggle generated artifacts controlled by "tsera dev".
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  // Folder storing generated schemas, manifests, and OpenAPI files.
  outDir: ".tsera",
  // Source folders scanned for entities (add files or globs as needed).
  paths: {
    entities: ["core/entities"],
    // routes: ["app/back/routes/**/*.ts"],
  },

  // Database configuration
  db: {
    // Choose between "postgres", "mysql", or "sqlite".
    dialect: "sqlite",
    // SQLite database file path.
    file: "./app/db/tsera.sqlite",
    // Example PostgreSQL configuration:
    // dialect: "postgres",
    // urlEnv: "TSERA_DATABASE_URL",
    // ssl: "prefer",
  },

  // Backend (Hono) configuration
  back: {
    port: 3001,
    host: "localhost",
    apiPrefix: "/api/v1",
  },

  // Frontend (Lume) configuration
  front: {
    port: 3000,
    srcDir: "./",
    destDir: "./.tsera/.temp_front",
  },
  // Deployment configuration
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "app/back/main.ts",
    envFile: ".env.deploy",
  },
  // List of enabled deployment providers for CD (empty = no CD).
  // Configure via "tsera deploy init" or during "tsera init".
  deployTargets: [],

  // Available environment names for DENO_ENV validation.
  // Used throughout the project for environment-specific behavior.
  environments: ["dev", "staging", "prod"],

  // Development mode flag.
  // When true, enables development-specific features.
  dev: true,

  // Module activation
  modules: {
    hono: true,
    lume: true,
    docker: true,
    ci: true,
    secrets: true,
  },
};

export default config;
