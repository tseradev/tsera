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
    throw new Error(`Champ ${field} manquant ou invalide dans la configuration TSera.`);
  }
}

function assertDbConfig(value: unknown): asserts value is TseraConfig["db"] {
  if (!value || typeof value !== "object") {
    throw new Error("Configuration base de données invalide.");
  }
  const db = value as Record<string, unknown>;
  assertString(db.dialect, "db.dialect");
  assertString(db.connectionString, "db.connectionString");
  assertString(db.migrationsDir, "db.migrationsDir");
  assertString(db.schemaDir, "db.schemaDir");
}

function validateConfig(config: TseraConfig): void {
  assertString(config.projectName, "projectName");
  assertString(config.rootDir, "rootDir");
  assertString(config.entitiesDir, "entitiesDir");
  assertString(config.artifactsDir, "artifactsDir");
  assertDbConfig(config.db);
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
    throw new Error(`Aucune configuration exportée par ${project.configPath}`);
  }

  validateConfig(config as TseraConfig);

  return {
    configPath: project.configPath,
    config: config as TseraConfig,
  };
}
