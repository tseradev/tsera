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
 * Represents the active modules in a TSera project.
 */
export interface ActiveModules {
  /** Backend module (Hono API) is present */
  backend: boolean;
  /** Frontend module (Fresh SSR) is present */
  frontend: boolean;
  /** Secrets module (type-safe secrets management) is present */
  secrets: boolean;
}

/**
 * Detects which modules are active in the given project directory.
 *
 * A module is considered active if its entry point and configuration exist:
 * - Backend: `app/back/main.ts` exists
 * - Frontend: `app/front/main.ts` and `app/front/vite.config.ts` exist
 * - Secrets: `config/secrets/manager.ts` exists
 *
 * @param projectDir - The root directory of the TSera project
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
  const frontendConfig = join(projectDir, "app", "front", "vite.config.ts");
  const secretsManager = join(projectDir, "config", "secrets", "manager.ts");

  const [
    hasBackend,
    hasFrontend,
    hasFrontendConfig,
    hasSecrets,
  ] = await Promise.all([
    exists(backendEntry),
    exists(frontendEntry),
    exists(frontendConfig),
    exists(secretsManager),
  ]);

  return {
    backend: hasBackend,
    frontend: hasFrontend && hasFrontendConfig,
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
