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
  db: {
    // Choose between "postgres", "mysql", or "sqlite".
    dialect: "sqlite",
    // SQLite database file path.
    file: "./data/tsera.sqlite",
    // Example PostgreSQL configuration:
    // dialect: "postgres",
    // urlEnv: "TSERA_DATABASE_URL",
    // ssl: "prefer",
  },
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "app/back/main.ts",
    envFile: ".env.deploy",
  },
  // List of enabled deployment providers for CD (empty = no CD).
  // Configure via "tsera deploy init" or during "tsera init".
  deployTargets: [],
  modules: {
    hono: true,
    lume: true,
    docker: true,
    ci: true,
    secrets: true,
  },
};

export default config;
