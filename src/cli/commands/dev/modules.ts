/**
 * Module detection utilities for TSera dev command.
 *
 * Detects which modules are active in a project by checking for
 * specific files and directories.
 *
 * @module
 */

import { join } from "../../../shared/path.ts";

/**
 * Checks if a file or directory exists.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Represents active modules in a TSera project.
 */
export interface ActiveModules {
  /** Backend module (Hono API) is present */
  backend: boolean;
  /** Frontend module (Lume MPA) is present */
  frontend: boolean;
  /** Secrets module (type-safe secrets management) is present */
  secrets: boolean;
}

/**
 * Detects which modules are active in given project directory.
 *
 * A module is considered active if its entry point and configuration exist:
 * - Backend: `app/back/main.ts` exists
 * - Frontend: `app/front/main.ts` exists (Fresh) OR `config/front/_config.ts` exists (Lume) OR `app/front/src/` exists (Lume)
 * - Secrets: `config/secrets/manager.ts` exists
 *
 * @param projectDir - The root directory of TSera project
 * @returns Object indicating which modules are active
 *
 * @example
 * ```typescript
 * const modules = await detectActiveModules("./my-project");
 * if (modules.backend) {
 *   console.log("Backend is active");
 * }
 * if (modules.frontend) {
 *   console.log("Frontend is active");
 * }
 * ```
 */
export async function detectActiveModules(projectDir: string): Promise<ActiveModules> {
  const backendEntry = join(projectDir, "app", "back", "main.ts");
  const frontendEntry = join(projectDir, "app", "front", "main.ts");
  const frontendConfig = join(projectDir, "config", "front", "_config.ts"); // Lume entry point
  const frontendSrcDir = join(projectDir, "app", "front", "src"); // Lume pages directory
  const secretsManager = join(projectDir, "config", "secrets", "manager.ts");

  const [
    hasBackend,
    hasFrontendEntry,
    hasFrontendConfig,
    hasFrontendSrc,
    hasSecrets,
  ] = await Promise.all([
    exists(backendEntry),
    exists(frontendEntry),
    exists(frontendConfig),
    exists(frontendSrcDir),
    exists(secretsManager),
  ]);

  // Frontend is active if:
  // - Fresh-style: main.ts exists
  // - Lume-style: _config.ts or src/ exists
  const hasFrontend = hasFrontendEntry || hasFrontendConfig || hasFrontendSrc;

  return {
    backend: hasBackend,
    frontend: hasFrontend,
    secrets: hasSecrets,
  };
}

/**
 * Gets a human-readable name for a module.
 *
 * @param module - The module identifier
 * @returns Capitalized module name
 */
export function getModuleName(
  module: "backend" | "frontend" | "secrets",
): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}
