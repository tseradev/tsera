import { normalizeNewlines } from "../../../../shared/newline.ts";

/**
 * Generates the default tsera.config.ts file content.
 *
 * @param projectName - Optional project name (currently unused, reserved for future use)
 */
export function generateConfigFile(_projectName?: string): string {
  const envVar = "TSERA_DATABASE_URL";
  const sqliteFile = "data/tsera.sqlite";

  const template = `// TSera configuration (full profile with comments).
import type { TseraConfig } from "tsera/cli/contracts/types.ts";

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
    urlEnv: "${envVar}",
    ssl: "prefer",
    // Example SQLite configuration:
    // dialect: "sqlite",
    // file: "${sqliteFile}",
  },
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "main.ts",
    envFile: ".env.deploy",
  },
};

export default config;
`;

  return normalizeNewlines(template);
}
