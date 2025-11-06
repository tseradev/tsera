const encoder = new TextEncoder();

export interface HashOptions {
  version: string;
  salt?: string;
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const view = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes
    : bytes.slice();
  const source = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength
    ? view.buffer
    : view.slice().buffer;
  const buffer = await crypto.subtle.digest("SHA-256", source as ArrayBuffer);
  return encodeHex(new Uint8Array(buffer));
}

export async function hashText(text: string): Promise<string> {
  return await hashBytes(encoder.encode(text));
}

export async function hashValue(value: unknown, options: HashOptions): Promise<string> {
  const serialised = stableStringify({
    version: options.version,
    salt: options.salt ?? null,
    value,
  });
  return await hashText(serialised);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = sortValue(val);
    }
    return result;
  }
  return value;
}

function encodeHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}
