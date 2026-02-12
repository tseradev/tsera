const encoder = new TextEncoder();

/**
 * Options for hash computation.
 */
export type HashOptions = {
  /** Version string to include in the hash. */
  version: string;
  /** Optional salt for hash differentiation. */
  salt?: string;
};

/**
 * Computes a SHA-256 hash of the provided bytes.
 *
 * @param bytes - Byte array to hash.
 * @returns Hexadecimal representation of the hash.
 */
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

/**
 * Computes a SHA-256 hash of the provided text string.
 *
 * @param text - Text string to hash.
 * @returns Hexadecimal representation of the hash.
 */
export async function hashText(text: string): Promise<string> {
  return await hashBytes(encoder.encode(text));
}

/**
 * Computes a deterministic hash of an arbitrary value by serialising it to JSON.
 *
 * @param value - Value to hash (will be serialised to JSON).
 * @param options - Hash computation options.
 * @returns Hexadecimal representation of the hash.
 */
export async function hashValue(value: unknown, options: HashOptions): Promise<string> {
  const serialised = stableStringify({
    version: options.version,
    salt: options.salt ?? null,
    value,
  });
  return await hashText(serialised);
}

/**
 * Serialises a value to JSON with deterministic key ordering.
 *
 * @param value - Value to serialise.
 * @returns JSON string with sorted keys.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Recursively sorts object keys and normalises values for deterministic serialisation.
 *
 * @param value - Value to sort.
 * @returns Sorted and normalised value.
 */
function sortValue(value: unknown, visited = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item, visited));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof value === "object") {
    if (visited.has(value)) {
      return "[Circular]";
    }
    visited.add(value);

    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = sortValue(val, visited);
    }
    return result;
  }
  return value;
}

/**
 * Encodes a byte array to a hexadecimal string.
 *
 * @param bytes - Byte array to encode.
 * @returns Hexadecimal string representation.
 */
function encodeHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}
