/**
 * Database connection placeholder.
 *
 * This module centralizes database URL resolution and provides
 * a single place to wire a Deno-compatible database driver or ORM.
 *
 * @module
 */

type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

/**
 * Resolve the TSera runtime env accessor if the secrets module is enabled.
 */
function resolveTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["tsera"];
  if (!isTseraEnvAccessor(tsera)) {
    return undefined;
  }
  return tsera;
}

/**
 * Resolve the database URL, preferring tsera.env when available.
 */
export function resolveDatabaseUrl(): string {
  const tseraEnv = resolveTseraEnv();
  const databaseUrl = readEnvString(tseraEnv?.env("DATABASE_URL")) ??
    readEnvString(tseraEnv?.env("TSERA_DATABASE_URL")) ??
    Deno.env.get("DATABASE_URL") ??
    Deno.env.get("TSERA_DATABASE_URL");

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL (or TSERA_DATABASE_URL) is required. Set it in your environment or config/secret/.env.* file.",
    );
  }

  return databaseUrl;
}

/**
 * Resolved database URL (throws if missing).
 */
export const databaseUrl = resolveDatabaseUrl();

/**
 * TODO: Initialize your database client or ORM here.
 *
 * Example:
 *   import { createClient } from "jsr:@your/db-driver";
 *   export const db = createClient(databaseUrl);
 */

function readEnvString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isTseraEnvAccessor(value: unknown): value is TseraEnvAccessor {
  return isRecord(value) && typeof value["env"] === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
