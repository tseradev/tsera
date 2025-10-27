import { dirname, join } from "../../shared/path.ts";

export interface SafeWriteResult {
  /** Whether the file contents were written to disk. */
  written: boolean;
  /** Indicates that the file contents differ from the previous snapshot. */
  changed: boolean;
  /** Absolute path of the file written. */
  path: string;
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return;
    }
    throw error;
  }
}

function toUint8(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

function decoderFor(input: string | Uint8Array): TextDecoder | null {
  return typeof input === "string" ? new TextDecoder() : null;
}

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

  await Deno.writeFile(absolutePath, newContent);
  return { written: true, changed: true, path: absolutePath };
}

function compareContent(
  existing: Uint8Array,
  incoming: Uint8Array,
  rawIncoming: string | Uint8Array,
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }

  if (typeof rawIncoming === "string") {
    const decoder = decoderFor(rawIncoming);
    if (decoder) {
      const current = decoder.decode(existing);
      return current === rawIncoming;
    }
  }

  for (let index = 0; index < existing.length; index++) {
    if (existing[index] !== incoming[index]) {
      return false;
    }
  }
  return true;
}

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

export async function writeJsonFile(path: string, value: unknown): Promise<SafeWriteResult> {
  const sorted = sortJson(value);
  const json = JSON.stringify(sorted, null, 2) + "\n";
  return await safeWrite(path, json);
}

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

export function toProjectPath(projectDir: string, ...segments: string[]): string {
  return join(projectDir, ...segments);
}
