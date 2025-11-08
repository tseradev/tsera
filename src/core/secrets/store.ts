/**
 * @module secrets/store
 * Secure secret storage using Deno KV with optional AES-GCM encryption.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";

/**
 * Cache of warnings already displayed to avoid repetition.
 */
const displayedWarnings = new Set<string>();

/**
 * Reset the warning cache (useful for tests).
 */
export function resetWarningCache(): void {
  displayedWarnings.clear();
}

/**
 * Versioned secret value format stored in KV.
 */
interface SecretValue {
  v: 1;
  enc: boolean;
  iv?: string; // base64-encoded IV (only if enc=true)
  data: string; // base64-encoded ciphertext or plain serialized value
}

/**
 * Secret store interface for environment-isolated key-value storage.
 */
export interface SecretStore {
  /**
   * Store a secret value for a specific environment and key.
   */
  set(env: string, key: string, value: unknown): Promise<void>;

  /**
   * Retrieve a secret value for a specific environment and key.
   */
  get(env: string, key: string): Promise<unknown>;

  /**
   * Get all secrets for a specific environment.
   * Can be implemented with kv.list({ prefix: ["secrets", env] })
   */
  getAll(env: string): Promise<Record<string, unknown>>;

  /**
   * Close the KV connection.
   */
  close(): void;
}

/**
 * Options for creating a secret store.
 */
export interface SecretStoreOptions {
  /**
   * Path to the Deno KV database.
   * Default: ".tsera/kv"
   */
  kvPath?: string;

  /**
   * Path to the TSera directory (for salt storage).
   * Default: ".tsera"
   */
  tseraDir?: string;

  /**
   * Encryption key for AES-256-GCM encryption.
   * If not provided, uses Deno.env.get("TSERA_SECRET_KEY").
   * If absent, secrets are stored in clear text with a warning.
   */
  encryptionKey?: string;
}

/**
 * Load or create a fixed salt (32 bytes) from .tsera/salt.
 */
async function getOrCreateSalt(tseraDir: string): Promise<Uint8Array> {
  const saltPath = join(tseraDir, "salt");
  try {
    const salt = await Deno.readFile(saltPath);
    if (salt.length !== 32) {
      throw new Error("Invalid salt length");
    }
    return salt;
  } catch {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    await ensureDir(tseraDir);
    await Deno.writeFile(saltPath, salt);
    return salt;
  }
}

/**
 * Derive AES-256-GCM key from passphrase using PBKDF2.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt data using AES-GCM.
 */
async function encrypt(
  data: string,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoded,
  );
  return { ciphertext: new Uint8Array(encrypted), iv };
}

/**
 * Decrypt data using AES-GCM.
 */
async function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Encode Uint8Array to base64.
 */
function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

/**
 * Decode base64 to Uint8Array.
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create a secret store with optional encryption.
 */
export async function createSecretStore(
  options?: SecretStoreOptions,
): Promise<SecretStore> {
  const kvPath = options?.kvPath || ".tsera/kv";
  const tseraDir = options?.tseraDir || ".tsera";
  const encryptionKey = options?.encryptionKey ||
    Deno.env.get("TSERA_SECRET_KEY");

  // Ensure tsera directory exists
  await ensureDir(tseraDir);

  // Open KV database (Deno.openKv will create the file/directory as needed)
  const kv = await Deno.openKv(kvPath);

  // Load or create salt
  const salt = await getOrCreateSalt(tseraDir);

  // Derive encryption key if provided
  let cryptoKey: CryptoKey | null = null;
  if (encryptionKey) {
    if (encryptionKey.length < 32) {
      const warningKey = "weak-encryption-key";
      if (!displayedWarnings.has(warningKey)) {
        displayedWarnings.add(warningKey);
        console.warn(
          "\x1b[33m[TSera Secrets]\x1b[0m Weak encryption key (< 32 chars)\n" +
            "Use a strong passphrase for production (32+ chars)",
        );
      }
    }
    cryptoKey = await deriveKey(encryptionKey, salt);
  } else {
    const warningKey = "store-not-encrypted";
    if (!displayedWarnings.has(warningKey)) {
      displayedWarnings.add(warningKey);
      console.warn(
        "\x1b[33m[TSera Secrets]\x1b[0m Store not encrypted (TSERA_SECRET_KEY not set)\n" +
          "Set TSERA_SECRET_KEY for production encryption",
      );
    }
  }

  return {
    async set(env: string, key: string, value: unknown): Promise<void> {
      const serialized = JSON.stringify(value);
      let secretValue: SecretValue;

      if (cryptoKey) {
        // Encrypt the value
        const { ciphertext, iv } = await encrypt(serialized, cryptoKey);
        secretValue = {
          v: 1,
          enc: true,
          iv: toBase64(iv),
          data: toBase64(ciphertext),
        };
      } else {
        // Store in clear text
        secretValue = {
          v: 1,
          enc: false,
          data: serialized,
        };
      }

      await kv.set(["secrets", env, key], secretValue);
    },

    async get(env: string, key: string): Promise<unknown> {
      const result = await kv.get<SecretValue>(["secrets", env, key]);
      if (!result.value) {
        return undefined;
      }

      const secretValue = result.value;

      if (secretValue.enc) {
        // Decrypt the value
        if (!cryptoKey) {
          throw new Error(
            "Cannot decrypt secret: TSERA_SECRET_KEY not provided",
          );
        }
        if (!secretValue.iv) {
          throw new Error("Invalid encrypted secret: missing IV");
        }
        const ciphertext = fromBase64(secretValue.data);
        const iv = fromBase64(secretValue.iv);
        const decrypted = await decrypt(ciphertext, iv, cryptoKey);
        return JSON.parse(decrypted);
      } else {
        // Parse clear text value
        return JSON.parse(secretValue.data);
      }
    },

    async getAll(env: string): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {};
      const entries = kv.list<SecretValue>({ prefix: ["secrets", env] });

      for await (const entry of entries) {
        const key = entry.key[2] as string; // ["secrets", env, key]
        const secretValue = entry.value;

        if (secretValue.enc) {
          if (!cryptoKey) {
            throw new Error(
              "Cannot decrypt secret: TSERA_SECRET_KEY not provided",
            );
          }
          if (!secretValue.iv) {
            throw new Error("Invalid encrypted secret: missing IV");
          }
          const ciphertext = fromBase64(secretValue.data);
          const iv = fromBase64(secretValue.iv);
          const decrypted = await decrypt(ciphertext, iv, cryptoKey);
          result[key] = JSON.parse(decrypted);
        } else {
          result[key] = JSON.parse(secretValue.data);
        }
      }

      return result;
    },

    close(): void {
      kv.close();
    },
  };
}

