import { resolve } from "../../shared/path.ts";
import type { ResolvedTseraConfig, TseraConfig } from "../contracts/types.ts";
import { resolveProject } from "./project.ts";

function pathToFileUrl(path: string): URL {
  let absolute = resolve(path);
  if (Deno.build.os === "windows") {
    absolute = absolute.replace(/\\/g, "/");
    if (!absolute.startsWith("/")) {
      absolute = `/${absolute}`;
    }
    return new URL(`file://${absolute}`);
  }
  return new URL(`file://${absolute}`);
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Field ${field} is missing or invalid in the TSera configuration.`);
  }
}

function assertDbConfig(value: unknown): asserts value is TseraConfig["db"] {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid database configuration.");
  }
  const db = value as Record<string, unknown>;
  assertString(db.dialect, "db.dialect");
  assertString(db.connectionString, "db.connectionString");
  assertString(db.migrationsDir, "db.migrationsDir");
  assertString(db.schemaDir, "db.schemaDir");
}

function assertOptionalEntitiesList(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error("The entities field must be an array of paths.");
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`Invalid entity path at index ${index} in entities.`);
    }
  }
}

function validateConfig(config: TseraConfig): void {
  assertString(config.projectName, "projectName");
  assertString(config.rootDir, "rootDir");
  assertString(config.entitiesDir, "entitiesDir");
  assertString(config.artifactsDir, "artifactsDir");
  assertDbConfig(config.db);
  const maybe = config as { entities?: unknown };
  assertOptionalEntitiesList(maybe.entities);
}

export async function resolveConfig(startDir: string): Promise<ResolvedTseraConfig> {
  const project = await resolveProject(startDir);
  const fileUrl = pathToFileUrl(project.configPath);
  const cacheBust = `t=${Date.now()}`;
  const importUrl = fileUrl.search.length > 0
    ? `${fileUrl.href}&${cacheBust}`
    : `${fileUrl.href}?${cacheBust}`;

  const mod = await import(importUrl);
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
