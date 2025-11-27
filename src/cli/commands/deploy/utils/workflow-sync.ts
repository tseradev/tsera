import { join } from "../../../../shared/path.ts";
import type { DeployProvider } from "../../../definitions.ts";
import { pathExists, safeWrite, removeFileIfExists } from "../../../utils/fsx.ts";
import { computeFileHash, computeWorkflowHash } from "./workflow-hash.ts";
import {
  readWorkflowsMeta,
  removeWorkflowFromMeta,
  updateWorkflowHash,
} from "./workflow-meta.ts";

/**
 * Options for synchronizing a workflow.
 */
export interface SyncWorkflowOptions {
  /** Project directory. */
  projectDir: string;
  /** Source workflow path (config/cd/<provider>/<name>.yml). */
  sourcePath: string;
  /** Target workflow path (.github/workflows/cd-<provider>-<name>.yml). */
  targetPath: string;
  /** Force overwrite even if the file has been manually modified. */
  force: boolean;
}

/**
 * Result of workflow synchronization.
 */
export interface SyncResult {
  /** Action performed: created, updated, skipped, conflict. */
  action: "created" | "updated" | "skipped" | "conflict";
  /** Reason for the action (for logs). */
  reason?: string;
}

/**
 * Synchronizes a CD workflow from its source to the .github/workflows/ directory.
 * Applies hash-based protection logic to avoid overwriting manual modifications.
 *
 * @param options - Synchronization options.
 * @returns Synchronization result.
 */
export async function syncWorkflow(
  options: SyncWorkflowOptions,
): Promise<SyncResult> {
  const { projectDir, sourcePath, targetPath, force } = options;

  // 1. Read source workflow
  const sourceContent = await Deno.readTextFile(sourcePath);
  const generatedHash = await computeWorkflowHash(sourceContent);

  // 2. Read metadata
  const meta = await readWorkflowsMeta(projectDir);
  const recordedHash = meta[targetPath];

  // 3. Check if generated file exists
  const absoluteTargetPath = join(projectDir, targetPath);
  const fileExists = await pathExists(absoluteTargetPath);

  if (!fileExists) {
    // Create + record hash
    await safeWrite(absoluteTargetPath, sourceContent);
    await updateWorkflowHash(projectDir, targetPath, generatedHash);
    return { action: "created" };
  }

  // 4. File exists → compare hashes
  const currentHash = await computeFileHash(absoluteTargetPath);

  if (!recordedHash) {
    // Manual file → skip (unless --force)
    if (force) {
      await safeWrite(absoluteTargetPath, sourceContent);
      await updateWorkflowHash(projectDir, targetPath, generatedHash);
      return { action: "updated", reason: "forced-overwrite-manual-file" };
    }
    return {
      action: "skipped",
      reason: "file-exists-but-not-tracked-manual-modification",
    };
  }

  if (recordedHash === currentHash) {
    // File not modified → ok to regenerate
    await safeWrite(absoluteTargetPath, sourceContent);
    await updateWorkflowHash(projectDir, targetPath, generatedHash);
    return { action: "updated" };
  }

  // Different hash → file manually modified
  if (force) {
    await safeWrite(absoluteTargetPath, sourceContent);
    await updateWorkflowHash(projectDir, targetPath, generatedHash);
    return { action: "updated", reason: "forced-overwrite-modified-file" };
  }

  return {
    action: "conflict",
    reason: "file-modified-manually-use-force-to-overwrite",
  };
}

/**
 * Removes a generated CD workflow and its entry in metadata.
 *
 * @param projectDir - Project directory.
 * @param workflowPath - Relative path of the workflow to remove.
 */
export async function removeWorkflow(
  projectDir: string,
  workflowPath: string,
): Promise<void> {
  const absolutePath = join(projectDir, workflowPath);
  await removeFileIfExists(absolutePath);
  await removeWorkflowFromMeta(projectDir, workflowPath);
}

/**
 * Lists available source workflows for a given provider.
 *
 * @param projectDir - Project directory.
 * @param provider - Deployment provider.
 * @returns List of source workflow file names.
 */
export async function listProviderWorkflows(
  projectDir: string,
  provider: DeployProvider,
): Promise<string[]> {
  const providerDir = join(projectDir, "config", "cd", provider);
  const files: string[] = [];

  try {
    for await (const entry of Deno.readDir(providerDir)) {
      if (entry.isFile && entry.name.endsWith(".yml")) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Directory doesn't exist, return empty array
      return [];
    }
    throw error;
  }

  return files.sort();
}

/**
 * Computes the list of workflows to generate for enabled providers.
 *
 * @param projectDir - Project directory.
 * @param providers - Enabled providers.
 * @returns List of workflows to generate with their source and target paths.
 */
export async function computeWorkflowsToGenerate(
  projectDir: string,
  providers: DeployProvider[],
): Promise<Array<{ sourcePath: string; targetPath: string }>> {
  const workflows: Array<{ sourcePath: string; targetPath: string }> = [];

  for (const provider of providers) {
    // List available source workflows for this provider in config/cd/<provider>/
    const workflowFiles = await listProviderWorkflows(projectDir, provider);

    for (const file of workflowFiles) {
      // Extract name without extension (e.g., "staging", "prod", "deploy", "pages")
      const name = file.replace(/\.yml$/, "");
      workflows.push({
        sourcePath: join(projectDir, "config", "cd", provider, file),
        targetPath: `.github/workflows/cd-${provider}-${name}.yml`,
      });
    }
  }

  return workflows;
}

