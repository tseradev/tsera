import { normalizeNewlines } from "../../../shared/newline.ts";
import { directoryHasEntries, pathExists, safeWrite } from "../../lib/fsx.ts";

/**
 * Ensures a directory is ready for use, creating it if necessary.
 *
 * @throws {Error} If the path exists and is not a directory, or if it's not empty and force is false.
 */
export async function ensureDirectoryReady(path: string, force: boolean): Promise<void> {
  if (await pathExists(path)) {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`The path ${path} already exists and is not a directory.`);
    }
    if (!force && await directoryHasEntries(path)) {
      throw new Error(`The directory ${path} is not empty. Use --force to continue.`);
    }
    return;
  }

  await Deno.mkdir(path, { recursive: true });
}

/**
 * Ensures a file path is writable, throwing if it exists and force is false.
 *
 * @throws {Error} If the file exists and force is false.
 */
export async function ensureWritable(path: string, force: boolean, label: string): Promise<void> {
  if (!await pathExists(path)) {
    return;
  }
  if (force) {
    return;
  }
  throw new Error(`${label} already exists. Use --force to regenerate it.`);
}

/**
 * Writes content to a file only if it doesn't exist (or if force is true).
 */
export async function writeIfMissing(
  path: string,
  content: string,
  force: boolean,
): Promise<void> {
  if (await pathExists(path) && !force) {
    return;
  }
  await safeWrite(path, normalizeNewlines(content));
}

/**
 * Normalises trailing separators from a project directory path.
 */
export function sanitizeProjectDir(projectDir: string): string {
  return projectDir.replace(/[\\/]+$/, "");
}

/**
 * Derives a concise label from an absolute project directory path.
 * Returns the last segment of the path.
 */
export function formatProjectLabel(projectDir: string): string {
  const segments = projectDir.split(/[/\\]+/).filter((part) => part.length > 0);
  return segments[segments.length - 1] ?? projectDir;
}
