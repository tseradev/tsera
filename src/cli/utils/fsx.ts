import { dirname, join } from "../../shared/path.ts";

export type SafeWriteResult = {
  /** Whether the file contents were written to disk. */
  written: boolean;
  /** Indicates that the file contents differ from the previous snapshot. */
  changed: boolean;
  /** Absolute path of the file written. */
  path: string;
};

/** Ensures a directory exists, creating it if necessary. */
export async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return;
    }
    throw error;
  }
}

/** Checks if a path exists on the filesystem. */
export async function pathExists(path: string): Promise<boolean> {
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

/** Checks if a directory has any entries (files or subdirectories). */
export async function directoryHasEntries(path: string): Promise<boolean> {
  for await (const _ of Deno.readDir(path)) {
    return true;
  }
  return false;
}

/**
 * Converts a string or Uint8Array to Uint8Array.
 *
 * @param value - Value to convert.
 * @returns Uint8Array representation.
 */
function toUint8(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

/**
 * Reads a file if it exists, returning null if not found.
 *
 * @param path - File path to read.
 * @returns File contents, or null if the file doesn't exist.
 * @throws {Error} For errors other than file not found.
 */
async function readFileIfExists(path: string): Promise<Uint8Array | null> {
  try {
    return await Deno.readFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * Writes content to a file only if it differs from the existing content.
 *
 * @param path - Absolute file path.
 * @param content - Content to write (string or binary).
 * @returns Result indicating whether the file was written and if it changed.
 */
export async function safeWrite(
  path: string,
  content: string | Uint8Array,
): Promise<SafeWriteResult> {
  const absolutePath = path;
  await ensureDir(dirname(absolutePath));

  const newContent = toUint8(content);
  const existing = await readFileIfExists(absolutePath);

  if (existing !== null && compareContent(existing, newContent, content)) {
    return { written: false, changed: false, path: absolutePath };
  }

  // Atomic write: write to temp file then rename
  const tempPath = `${absolutePath}.tmp.${crypto.randomUUID()}`;
  try {
    await Deno.writeFile(tempPath, newContent);
    await Deno.rename(tempPath, absolutePath);
  } catch (error) {
    // Clean up temp file if rename fails
    await removeFileIfExists(tempPath);
    throw error;
  }

  return { written: true, changed: true, path: absolutePath };
}

/**
 * Compares existing file content with new content to determine if a write is needed.
 *
 * @param existing - Existing file content.
 * @param incoming - New content as bytes.
 * @param rawIncoming - New content in original format (for text comparison).
 * @returns {@code true} if contents are identical; otherwise {@code false}.
 */
function compareContent(
  existing: Uint8Array,
  incoming: Uint8Array,
  rawIncoming: string | Uint8Array,
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }

  if (typeof rawIncoming === "string") {
    const decoder = new TextDecoder();
    const current = decoder.decode(existing);
    return current === rawIncoming;
  }

  for (let index = 0; index < existing.length; index++) {
    if (existing[index] !== incoming[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Removes a file if it exists.
 *
 * @param path - File path to remove.
 * @returns {@code true} if the file was removed; {@code false} if it didn't exist.
 * @throws {Error} For errors other than file not found.
 */
export async function removeFileIfExists(path: string): Promise<boolean> {
  try {
    await Deno.remove(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Reads and parses a JSON file.
 *
 * @param path - File path to read.
 * @returns Parsed JSON value, or null if the file doesn't exist.
 * @throws {Error} If the file contains invalid JSON or other I/O errors occur.
 */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${path}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Writes a value to a JSON file with sorted keys for deterministic output.
 *
 * @param path - File path to write.
 * @param value - Value to serialise as JSON.
 * @returns Result indicating whether the file was written and if it changed.
 */
export async function writeJsonFile(path: string, value: unknown): Promise<SafeWriteResult> {
  const sorted = sortJson(value);
  const json = JSON.stringify(sorted, null, 2) + "\n";
  return await safeWrite(path, json);
}

/**
 * Recursively sorts object keys in a value for deterministic JSON serialisation.
 *
 * @param value - Value to sort.
 * @returns Value with sorted keys.
 */
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = sortJson(val);
    }
    return result;
  }
  return value;
}

/**
 * Joins project directory with path segments.
 *
 * @param projectDir - Project root directory.
 * @param segments - Path segments to join.
 * @returns Joined path.
 */
export function toProjectPath(projectDir: string, ...segments: string[]): string {
  return join(projectDir, ...segments);
}
