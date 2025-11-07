import {
  addImportDeclaration,
  createInMemorySourceFile,
  createTSeraProject,
} from "../../../utils/ts-morph.ts";

/**
 * Module configuration options passed during template initialization.
 */
export interface ModuleOptions {
  /** Enable Hono API module. */
  hono?: boolean;
  /** Enable Fresh frontend module. */
  fresh?: boolean;
  /** Enable Docker Compose module. */
  docker?: boolean;
  /** Enable CI/CD module. */
  ci?: boolean;
  /** Enable Secrets management module. */
  secrets?: boolean;
}

/**
 * Generates the default tsera.config.ts file content using TS-Morph.
 *
 * @param projectName - Optional project name (currently unused, reserved for future use).
 * @param modules - Module options to include in the generated config.
 * @returns Generated TypeScript config file content.
 */
export function generateConfigFile(
  _projectName?: string,
  modules: ModuleOptions = {},
): string {
  const envVar = "TSERA_DATABASE_URL";
  const sqliteFile = "data/tsera.sqlite";

  // Create a TS-Morph project and source file
  const project = createTSeraProject();
  const sourceFile = createInMemorySourceFile(project, "tsera.config.ts");

  // Add import for TseraConfig type
  addImportDeclaration(sourceFile, "tsera/cli/contracts/types.ts", {
    namedImports: ["TseraConfig"],
  });

  // Build the modules object if any modules are specified
  const hasModules = Object.keys(modules).length > 0;
  const modulesConfig = hasModules
    ? `
  modules: {
    hono: ${modules.hono !== false},
    fresh: ${modules.fresh !== false},
    docker: ${modules.docker !== false},
    ci: ${modules.ci !== false},
    secrets: ${modules.secrets !== false},
  },`
    : "";

  // Add the config constant with proper comments
  sourceFile.addStatements(`
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
  },${modulesConfig}
};

export default config;
`);

  // Format and get the generated text
  sourceFile.formatText();
  const text = sourceFile.getFullText();
  // Remove trailing newline to match golden file
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
