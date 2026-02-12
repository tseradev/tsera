import { join } from "../../shared/path.ts";
import { posixPath } from "../../shared/path.ts";
import type { EntityRuntime } from "../../core/entity.ts";
import type { TseraConfig } from "../definitions.ts";
import type { ArtifactDescriptor, DagEntityInput } from "./dag.ts";
import { buildArtifactId } from "./dag.ts";
import { buildDocsArtifacts } from "./artifacts/docs.ts";
import { buildDrizzleArtifacts } from "./artifacts/drizzle.ts";
import { buildTestArtifacts } from "./artifacts/tests.ts";
import { buildZodArtifacts } from "./artifacts/zod.ts";
import { buildProjectOpenAPIArtifact } from "./artifacts/openapi.ts";
import { buildDrizzleSchemaArtifact } from "./artifacts/drizzle-schema.ts";

type ModuleNamespace = Record<string, unknown>;

/**
 * Represents a discovered entity with its source file path.
 */
export type DiscoveredEntity = {
  /** Validated entity runtime. */
  entity: EntityRuntime;
  /** Relative path to the source file. */
  sourcePath: string;
};

const ENTITY_SUFFIX = ".ts";

/**
 * Prepares DAG inputs by discovering entities and building their artifacts.
 *
 * @param projectDir - Project root directory.
 * @param config - TSera configuration.
 * @returns Array of DAG entity inputs ready for graph construction.
 */
export async function prepareDagInputs(
  projectDir: string,
  config: TseraConfig,
): Promise<DagEntityInput[]> {
  const discovered = await discoverEntities(projectDir, config);
  const inputs: DagEntityInput[] = [];

  for (const item of discovered) {
    const artifacts = await buildEntityArtifacts(item.entity, config, projectDir);
    inputs.push({
      entity: item.entity,
      sourcePath: item.sourcePath,
      artifacts,
    });
  }

  const openapiArtifact = await buildProjectOpenAPIArtifact(
    discovered.map((item) => item.entity),
    config,
    projectDir,
  );
  if (openapiArtifact && inputs.length > 0) {
    inputs[0].artifacts.push(openapiArtifact);
  }

  return inputs;
}

/**
 * Discovers all entity runtimes in the configured paths.
 *
 * @param projectDir - Project root directory.
 * @param config - TSera configuration.
 * @returns Array of discovered entities sorted by path and name.
 * @throws {Error} If an entity path doesn't exist or no entities are found.
 */
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

/**
 * Builds all artifacts for a single entity based on configuration.
 *
 * @param entity - Entity runtime.
 * @param config - TSera configuration.
 * @returns Array of artifact descriptors with dependency information.
 */
export async function buildEntityArtifacts(
  entity: EntityRuntime,
  config: TseraConfig,
  projectDir: string,
): Promise<ArtifactDescriptor[]> {
  const context = { entity, config, projectDir } as const;
  const descriptors: ArtifactDescriptor[] = [];
  let previousStageIds: string[] = [];

  const pushStage = (artifacts: ArtifactDescriptor[]): void => {
    if (artifacts.length === 0) {
      return;
    }
    const dependencies = previousStageIds;
    const stageIds: string[] = [];

    for (const artifact of artifacts) {
      const id = buildArtifactId(artifact, entity.name);
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
    pushStage(await buildDrizzleSchemaArtifact(context));
  }

  if (config.docs && entity.doc) {
    pushStage(await buildDocsArtifacts(context));
  }

  if (config.tests && entity.test === "smoke") {
    pushStage(await buildTestArtifacts(context));
  }

  return descriptors;
}

/**
 * Gathers all entity file paths from the configured entity paths.
 *
 * @param projectDir - Project root directory.
 * @param config - TSera configuration.
 * @returns Array of relative paths to entity files.
 * @throws {Error} If a configured path doesn't exist or is invalid.
 */
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
        throw new Error(`Configured entity path ${entry} does not exist at ${absolute}.`);
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

/**
 * Recursively walks a directory to find entity files.
 *
 * @param directory - Directory to walk.
 * @param onEntity - Callback invoked for each entity file found.
 */
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
    // Skip test files, index files, and other non-entity files
    const lowerName = entry.name.toLowerCase();
    if (
      lowerName.endsWith(".test.ts") ||
      lowerName === "index.ts" ||
      lowerName.startsWith("_")
    ) {
      continue;
    }
    if (!lowerName.endsWith(ENTITY_SUFFIX)) {
      continue;
    }
    await onEntity(entryPath);
  }
}

/**
 * Removes duplicate paths while preserving order.
 *
 * @param values - Array of path strings.
 * @returns Deduplicated array.
 */
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

/**
 * Loads entity runtimes from a TypeScript module file.
 *
 * @param path - Absolute path to the entity file.
 * @param projectDir - Optional project root directory for import resolution.
 * @returns Array of entity runtimes found in the module.
 * @throws {Error} If no entities are exported by the file.
 */
async function loadEntityDefinitions(
  path: string,
  projectDir?: string,
): Promise<EntityRuntime[]> {
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

/**
 * Extracts entity runtimes from a module namespace.
 *
 * @param mod - Module namespace to inspect.
 * @returns Array of entity runtimes found.
 */
function extractEntities(mod: ModuleNamespace): EntityRuntime[] {
  const entities: EntityRuntime[] = [];
  const seen = new Set<string>();

  const consider = (candidate: unknown): void => {
    if (isEntityRuntime(candidate) && !seen.has(candidate.name)) {
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

/**
 * Type guard verifying whether a value is a valid entity runtime.
 *
 * @param value - Value to inspect.
 * @returns {@code true} if the value is an entity runtime; otherwise {@code false}.
 */
function isEntityRuntime(value: unknown): value is EntityRuntime {
  return Boolean(
    value && typeof value === "object" &&
      (value as Record<string, unknown>).__brand === "TSeraEntity" &&
      "schema" in (value as Record<string, unknown>) &&
      "public" in (value as Record<string, unknown>) &&
      "input" in (value as Record<string, unknown>) &&
      "fields" in (value as Record<string, unknown>),
  );
}

/**
 * Converts a file path to a file:// URL for dynamic import.
 *
 * @param path - File path to convert.
 * @returns File URL string with cache-busting query parameter.
 */
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

/**
 * Determines whether a path is absolute.
 *
 * @param path - Path to check.
 * @returns {@code true} if the path is absolute; otherwise {@code false}.
 */
function isAbsolutePath(path: string): boolean {
  if (path.startsWith("/")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Appends a cache-busting query parameter to a URL.
 *
 * @param url - URL to modify.
 * @returns URL string with cache-busting parameter.
 */
function appendCacheBust(url: URL): string {
  const cacheBust = `t=${Date.now()}`;
  return url.search.length > 0 ? `${url.href}&${cacheBust}` : `${url.href}?${cacheBust}`;
}

/**
 * Converts an absolute path to a project-relative path.
 *
 * @param projectDir - Project root directory.
 * @param absolutePath - Absolute path to convert.
 * @returns Relative path from project root.
 */
function toProjectRelative(projectDir: string, absolutePath: string): string {
  const project = projectDir.replace(/\\/g, "/");
  const absolute = absolutePath.replace(/\\/g, "/");
  const relative = posixPath.relative(project, absolute);
  return relative.length === 0 ? "." : relative;
}

/**
 * Merges two arrays of dependency identifiers, removing duplicates.
 *
 * @param existing - Existing dependencies.
 * @param previousStage - Dependencies from previous stage.
 * @returns Merged array of unique dependencies.
 */
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

/**
 * Compares two strings for sorting.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Comparison result (-1, 0, or 1).
 */
function compareStrings(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
