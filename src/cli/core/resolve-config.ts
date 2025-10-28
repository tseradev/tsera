import { join } from "../../shared/path.ts";
import type { ResolvedTseraConfig, TseraConfig } from "../contracts/types.ts";
import { resolveProject } from "./project.ts";

function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Field ${field} is missing or invalid in the TSera configuration.`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Field ${field} is missing or invalid in the TSera configuration.`);
  }
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Field ${field} must be an array of strings in the TSera configuration.`);
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`Invalid entry at index ${index} in field ${field}.`);
    }
  }
}

function assertPathsConfig(value: unknown): asserts value is TseraConfig["paths"] {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid paths configuration.");
  }

  const paths = value as Record<string, unknown>;
  assertStringArray(paths.entities, "paths.entities");
  if ((paths.entities as string[]).length === 0) {
    throw new Error("The TSera configuration must declare at least one entity path.");
  }
  if (paths.routes !== undefined) {
    assertStringArray(paths.routes, "paths.routes");
  }
}

function assertDbConfig(value: unknown): asserts value is TseraConfig["db"] {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid database configuration.");
  }

  const db = value as Record<string, unknown>;
  const dialect = db.dialect;
  if (dialect !== "postgres" && dialect !== "mysql" && dialect !== "sqlite") {
    throw new Error("Unsupported database dialect. Expected postgres, mysql, or sqlite.");
  }

  if (dialect === "postgres") {
    assertString(db.urlEnv, "db.urlEnv");
    if (
      db.ssl !== undefined && db.ssl !== "disable" && db.ssl !== "prefer" && db.ssl !== "require"
    ) {
      throw new Error("Invalid Postgres SSL mode. Expected disable, prefer, or require.");
    }
    if (db.file !== undefined) {
      throw new Error("Postgres configuration must not declare a file path.");
    }
    return;
  }

  if (dialect === "mysql") {
    assertString(db.urlEnv, "db.urlEnv");
    if (db.ssl !== undefined && typeof db.ssl !== "boolean") {
      throw new Error("MySQL SSL configuration must be a boolean when provided.");
    }
    if (db.file !== undefined) {
      throw new Error("MySQL configuration must not declare a file path.");
    }
    return;
  }

  if (db.file === undefined || typeof db.file !== "string" || db.file.length === 0) {
    throw new Error("SQLite configuration requires a non-empty file path.");
  }
  if (db.ssl !== undefined) {
    throw new Error("SQLite configuration does not support SSL options.");
  }
  if (db.urlEnv !== undefined && (typeof db.urlEnv !== "string" || db.urlEnv.length === 0)) {
    throw new Error("SQLite urlEnv must be a non-empty string when provided.");
  }
}

function assertDeployConfig(value: unknown): asserts value is TseraConfig["deploy"] {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid deploy configuration.");
  }

  const deploy = value as Record<string, unknown>;
  if (
    deploy.target !== "deno_deploy" && deploy.target !== "cloudflare" &&
    deploy.target !== "node_pm2"
  ) {
    throw new Error("Unsupported deploy target. Expected deno_deploy, cloudflare, or node_pm2.");
  }
  assertString(deploy.entry, "deploy.entry");
  if (deploy.envFile !== undefined) {
    assertString(deploy.envFile, "deploy.envFile");
  }
}

function validateConfig(config: TseraConfig): void {
  assertBoolean(config.openapi, "openapi");
  assertBoolean(config.docs, "docs");
  assertBoolean(config.tests, "tests");
  assertBoolean(config.telemetry, "telemetry");
  assertString(config.outDir, "outDir");
  assertPathsConfig(config.paths);
  assertDbConfig(config.db);
  assertDeployConfig(config.deploy);
}

export async function resolveConfig(startDir: string): Promise<ResolvedTseraConfig> {
  const project = await resolveProject(startDir);
  const bundled = await bundleConfigModule(project.configPath);
  const mod = await import(bundled);
  const config: unknown = mod.default ?? mod.config ?? mod.CONFIG;
  if (!config) {
    throw new Error(`No configuration exported by ${project.configPath}`);
  }

  validateConfig(config as TseraConfig);

  return {
    configPath: project.configPath,
    config: config as TseraConfig,
  };
}

async function bundleConfigModule(configPath: string): Promise<string> {
  const source = await Deno.readTextFile(configPath);
  const sanitized = stripTypeImports(source);
  const withSourceUrl = `${sanitized}\n//# sourceURL=${pathToFileUrl(configPath).href}`;
  const encoded = toBase64(withSourceUrl);
  return `data:application/typescript;base64,${encoded}`;
}

function stripTypeImports(source: string): string {
  return source.replace(/^\s*import\s+type\s+[^;]+;\s*\n?/gm, "");
}

function pathToFileUrl(path: string): URL {
  let absolute = join(Deno.cwd(), path);
  if (isAbsolutePath(path)) {
    absolute = path;
  }

  if (Deno.build.os === "windows") {
    absolute = absolute.replace(/\\/g, "/");
    if (!absolute.startsWith("/")) {
      absolute = `/${absolute}`;
    }
    return new URL(`file://${absolute}`);
  }

  const normalised = absolute.replace(/\\/g, "/");
  return new URL(`file://${normalised}`);
}

function isAbsolutePath(path: string): boolean {
  if (path.startsWith("/")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(path);
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
