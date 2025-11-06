import { join } from "../../shared/path.ts";
import { posixPath } from "../../shared/path.ts";
import type { EntityDef } from "../../core/entity.ts";
import { pascalToSnakeCase } from "../../core/utils/strings.ts";
import type { TseraConfig } from "../contracts/types.ts";
import type { ArtifactDescriptor, DagEntityInput } from "./dag.ts";
import { buildDocsArtifacts } from "./artifacts/docs.ts";
import { buildDrizzleArtifacts } from "./artifacts/drizzle.ts";
import { buildTestArtifacts } from "./artifacts/tests.ts";
import { buildZodArtifacts } from "./artifacts/zod.ts";
import { buildProjectOpenAPIArtifact } from "./artifacts/openapi.ts";

type ModuleNamespace = Record<string, unknown>;

export interface DiscoveredEntity {
  entity: EntityDef;
  sourcePath: string;
}

const ENTITY_SUFFIX = ".entity.ts";

export async function prepareDagInputs(
  projectDir: string,
  config: TseraConfig,
): Promise<DagEntityInput[]> {
  const discovered = await discoverEntities(projectDir, config);
  const inputs: DagEntityInput[] = [];

  for (const item of discovered) {
    const artifacts = await buildEntityArtifacts(item.entity, config);
    inputs.push({
      entity: item.entity,
      sourcePath: item.sourcePath,
      artifacts,
    });
  }

  const openapiArtifact = buildProjectOpenAPIArtifact(
    discovered.map((item) => item.entity),
    config,
  );
  if (openapiArtifact && inputs.length > 0) {
    inputs[0].artifacts.push(openapiArtifact);
  }

  return inputs;
}

export async function discoverEntities(
  projectDir: string,
  config: TseraConfig,
): Promise<DiscoveredEntity[]> {
  const candidates = await gatherEntityPaths(projectDir, config);
  const discovered: DiscoveredEntity[] = [];

  for (const relativePath of candidates) {
    const absolutePath = join(projectDir, relativePath);
    const definitions = await loadEntityDefinitions(absolutePath, projectDir);
    if (definitions.length === 0) {
      throw new Error(`No entity exported by ${relativePath}`);
    }
    for (const entity of definitions) {
      discovered.push({
        entity,
        sourcePath: toProjectRelative(projectDir, absolutePath),
      });
    }
  }

  discovered.sort((a, b) => {
    const byPath = compareStrings(a.sourcePath, b.sourcePath);
    if (byPath !== 0) {
      return byPath;
    }
    return compareStrings(a.entity.name, b.entity.name);
  });

  return discovered;
}

export async function buildEntityArtifacts(
  entity: EntityDef,
  config: TseraConfig,
): Promise<ArtifactDescriptor[]> {
  const context = { entity, config } as const;
  const descriptors: ArtifactDescriptor[] = [];
  let previousStageIds: string[] = [];

  const pushStage = (artifacts: ArtifactDescriptor[]): void => {
    if (artifacts.length === 0) {
      return;
    }
    const dependencies = previousStageIds;
    const stageIds: string[] = [];

    for (const artifact of artifacts) {
      const id = buildNodeId(entity.name, artifact);
      stageIds.push(id);
      const mergedDependencies = mergeDependencies(artifact.dependsOn, dependencies);
      descriptors.push({
        ...artifact,
        dependsOn: mergedDependencies.length > 0 ? mergedDependencies : undefined,
      });
    }

    previousStageIds = stageIds;
  };

  pushStage(await buildZodArtifacts(context));

  if (entity.table) {
    pushStage(await buildDrizzleArtifacts(context));
  }

  if (config.docs && entity.doc) {
    pushStage(await buildDocsArtifacts(context));
  }

  if (config.tests && entity.test === "smoke") {
    pushStage(await buildTestArtifacts(context));
  }

  return descriptors;
}

async function gatherEntityPaths(
  projectDir: string,
  config: TseraConfig,
): Promise<string[]> {
  const collected: string[] = [];

  for (const entry of config.paths.entities) {
    const absolute = join(projectDir, entry);
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(absolute);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Configured entity path ${entry} does not exist.`);
      }
      throw error;
    }

    if (stat.isFile) {
      collected.push(toProjectRelative(projectDir, absolute));
      continue;
    }

    if (!stat.isDirectory) {
      throw new Error(`Configured entity path ${entry} must be a file or directory.`);
    }

    await walkEntities(absolute, (absolutePath) => {
      const relative = toProjectRelative(projectDir, absolutePath);
      collected.push(relative);
    });
  }

  return dedupePreserveOrder(collected.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1)));
}

async function walkEntities(
  directory: string,
  onEntity: (absolutePath: string) => Promise<void> | void,
): Promise<void> {
  for await (const entry of Deno.readDir(directory)) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory) {
      await walkEntities(entryPath, onEntity);
      continue;
    }
    if (!entry.isFile) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(ENTITY_SUFFIX)) {
      continue;
    }
    await onEntity(entryPath);
  }
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalised = value.replace(/\\/g, "/");
    if (seen.has(normalised)) {
      continue;
    }
    seen.add(normalised);
    result.push(normalised);
  }
  return result;
}

async function loadEntityDefinitions(
  path: string,
  projectDir?: string,
): Promise<EntityDef[]> {
  const url = toImportUrl(path);
  let originalCwd: string | undefined;

  // If projectDir is provided and contains deno.jsonc, change to that directory
  // so Deno can resolve import maps correctly
  if (projectDir) {
    try {
      const denoConfigPath = join(projectDir, "deno.jsonc");
      await Deno.stat(denoConfigPath);
      originalCwd = Deno.cwd();
      Deno.chdir(projectDir);
    } catch {
      // deno.jsonc doesn't exist, continue without changing directory
    }
  }

  try {
    const mod = await import(url) as ModuleNamespace;
    return extractEntities(mod);
  } finally {
    if (originalCwd) {
      Deno.chdir(originalCwd);
    }
  }
}

function extractEntities(mod: ModuleNamespace): EntityDef[] {
  const entities: EntityDef[] = [];
  const seen = new Set<string>();

  const consider = (candidate: unknown): void => {
    if (isEntityDef(candidate) && !seen.has(candidate.name)) {
      seen.add(candidate.name);
      entities.push(candidate);
    }
  };

  consider(mod.default);
  for (const value of Object.values(mod)) {
    consider(value);
  }

  return entities;
}

function isEntityDef(value: unknown): value is EntityDef {
  return Boolean(
    value && typeof value === "object" &&
    (value as Record<string, unknown>).__brand === "TSeraEntity",
  );
}

function toImportUrl(path: string): string {
  let absolute = path;
  if (!isAbsolutePath(absolute)) {
    absolute = join(Deno.cwd(), absolute);
  }

  if (Deno.build.os === "windows") {
    absolute = absolute.replace(/\\/g, "/");
    if (!absolute.startsWith("/")) {
      absolute = `/${absolute}`;
    }
    return appendCacheBust(new URL(`file://${absolute}`));
  }

  const normalised = absolute.replace(/\\/g, "/");
  return appendCacheBust(new URL(`file://${normalised}`));
}

function isAbsolutePath(path: string): boolean {
  if (path.startsWith("/")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(path);
}

function appendCacheBust(url: URL): string {
  const cacheBust = `t=${Date.now()}`;
  return url.search.length > 0 ? `${url.href}&${cacheBust}` : `${url.href}?${cacheBust}`;
}

function toProjectRelative(projectDir: string, absolutePath: string): string {
  const project = projectDir.replace(/\\/g, "/");
  const absolute = absolutePath.replace(/\\/g, "/");
  const relative = posixPath.relative(project, absolute);
  return relative.length === 0 ? "." : relative;
}

function buildNodeId(entityName: string, artifact: ArtifactDescriptor): string {
  const slug = pascalToSnakeCase(entityName);
  return `${artifact.kind}:${slug}:${artifact.path}`;
}

function mergeDependencies(
  existing: string[] | undefined,
  previousStage: string[],
): string[] {
  const merged = new Set<string>();
  for (const value of existing ?? []) {
    merged.add(value);
  }
  for (const value of previousStage) {
    merged.add(value);
  }
  return Array.from(merged);
}

function compareStrings(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
