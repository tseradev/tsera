import { createInMemorySourceFile, createTSeraProject } from "../../../utils/ts-morph.ts";

/**
 * Module configuration options passed during template initialization.
 */
export type ModuleOptions = {
  /** Enable Hono API module. */
  hono?: boolean;
  /** Enable Lume frontend module. */
  lume?: boolean;
  /** Enable Docker Compose module. */
  docker?: boolean;
  /** Enable CI/CD module. */
  ci?: boolean;
  /** Enable Secrets management module. */
  secrets?: boolean;
};

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

  // Create a TS-Morph project and source file
  const project = createTSeraProject();
  const sourceFile = createInMemorySourceFile(project, "tsera.config.ts");

  // Build the modules object if any modules are specified
  const hasModules = Object.keys(modules).length > 0;
  const modulesConfig = hasModules
    ? `
  modules: {
    hono: ${modules.hono !== false},
    lume: ${modules.lume !== false},
    docker: ${modules.docker !== false},
    ci: ${modules.ci !== false},
    secrets: ${modules.secrets !== false},
  },`
    : "";

  // Add the config constant with proper comments
  // Note: We don't import TseraConfig type to avoid import resolution issues
  // when loading config dynamically from a compiled binary
  sourceFile.addStatements(`
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
    dialect: "postgres",
    // Environment variable supplying the connection URL.
    urlEnv: "${envVar}",
    ssl: "prefer",
    // Example SQLite configuration:
    // dialect: "sqlite",
    // file: "./data/tsera.sqlite",
  },
  deploy: {
    // Deployment target handled by "tsera update".
    target: "deno_deploy",
    entry: "app/back/main.ts",
    envFile: ".env.deploy",
  },
  // List of enabled deployment providers for CD (empty = no CD).
  // Configure via "tsera deploy init" or during "tsera init".
  deployTargets: [],${modulesConfig}
};

export default config;
`);

  // Format and get the generated text
  sourceFile.formatText();
  let text = sourceFile.getFullText();
  // Remove leading newline if present (TS-Morph sometimes adds one)
  if (text.startsWith("\n")) {
    text = text.slice(1);
  }
  // Ensure trailing newline to match golden file
  return text.endsWith("\n") ? text : `${text}\n`;
}
