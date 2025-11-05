import { dirname, join, resolve } from "../../shared/path.ts";
import { pathExists } from "./fsx.ts";

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

export interface ProjectResolution {
  rootDir: string;
  configPath: string;
}

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
