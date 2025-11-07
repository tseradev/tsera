import { dirname, join, resolve } from "../../shared/path.ts";
import { pathExists } from "./fsx.ts";

/**
 * Searches for a tsera.config.ts file starting from a directory and walking up the tree.
 *
 * @param startDir - Directory to start searching from.
 * @returns Absolute path to the config file, or null if not found.
 */
export async function findConfigPath(startDir: string): Promise<string | null> {
  let current = resolve(startDir);

  while (true) {
    const candidate = join(current, "tsera.config.ts");
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

/**
 * Result of resolving a TSera project.
 */
export interface ProjectResolution {
  /** Project root directory. */
  rootDir: string;
  /** Absolute path to the configuration file. */
  configPath: string;
}

/**
 * Resolves a TSera project by finding its configuration file.
 *
 * @param startDir - Directory to start searching from.
 * @returns Project resolution with root directory and config path.
 * @throws {Error} If no configuration file is found.
 */
export async function resolveProject(startDir: string): Promise<ProjectResolution> {
  const configPath = await findConfigPath(startDir);
  if (!configPath) {
    throw new Error(`Unable to find tsera.config.ts from ${startDir}`);
  }

  return {
    rootDir: dirname(configPath),
    configPath,
  };
}
