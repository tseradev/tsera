// TSera configuration (full profile with comments).
import type { TseraConfig } from "tsera/cli/contracts/types.ts";

const config: TseraConfig = {
  // Human-friendly project name (used in artifacts and documentation).
  projectName: "DemoApp",
  // Project root directory. Keep "." except for advanced setups.
  rootDir: ".",
  // Folder containing TSera entities (files *.entity.ts).
  entitiesDir: "domain",
  // Folder for generated artifacts (schemas, docs, openapi, tests...).
  artifactsDir: ".tsera",
  // Optional: explicit list of entities to load instead of the recursive scan.
  // entities: ["domain/User.entity.ts"],
  db: {
    // Target dialect for Drizzle migrations (postgres | sqlite).
    dialect: "postgres",
    // Connection string used by tests and the local runtime.
    connectionString: "postgres://localhost/demoapp",
    // Folder storing generated migrations.
    migrationsDir: "drizzle",
    // Folder for Drizzle schemas (generated automatically).
    schemaDir: "drizzle/schema",
  },
  deploy: [
    {
      // Main deployment target (e.g. Deno Deploy).
      name: "production",
      kind: "deno-deploy",
      envFile: ".env.deploy",
    },
    {
      // Example of a custom target driven by a shell script.
      name: "on-premise",
      kind: "custom-script",
      script: "scripts/deploy.sh",
      envFile: ".env.production",
    },
  ],
};

export default config;
