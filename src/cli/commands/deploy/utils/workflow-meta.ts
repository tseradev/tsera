import { join } from "../../../../shared/path.ts";
import { readJsonFile, writeJsonFile } from "../../../utils/fsx.ts";

/**
 * Interface for metadata of generated CD workflows.
 * Key = relative path of generated workflow, value = SHA-256 hash.
 */
export type WorkflowsMeta = {
  [workflowPath: string]: string;
};

/**
 * Reads workflow metadata from .tsera/workflows-meta.json.
 *
 * @param projectDir - Project directory.
 * @returns Workflow metadata, or empty object if file doesn't exist.
 */
export async function readWorkflowsMeta(
  projectDir: string,
): Promise<WorkflowsMeta> {
  const metaPath = join(projectDir, ".tsera", "workflows-meta.json");
  const meta = await readJsonFile<WorkflowsMeta>(metaPath);
  return meta ?? {};
}

/**
 * Writes workflow metadata to .tsera/workflows-meta.json.
 *
 * @param projectDir - Project directory.
 * @param meta - Metadata to write.
 */
export async function writeWorkflowsMeta(
  projectDir: string,
  meta: WorkflowsMeta,
): Promise<void> {
  const metaPath = join(projectDir, ".tsera", "workflows-meta.json");
  await writeJsonFile(metaPath, meta);
}

/**
 * Updates the hash of a specific workflow in metadata.
 *
 * @param projectDir - Project directory.
 * @param workflowPath - Relative path of the workflow (e.g., ".github/workflows/cd-docker-staging.yml").
 * @param hash - New SHA-256 hash.
 */
export async function updateWorkflowHash(
  projectDir: string,
  workflowPath: string,
  hash: string,
): Promise<void> {
  const meta = await readWorkflowsMeta(projectDir);
  meta[workflowPath] = hash;
  await writeWorkflowsMeta(projectDir, meta);
}

/**
 * Removes a workflow entry from metadata.
 *
 * @param projectDir - Project directory.
 * @param workflowPath - Relative path of the workflow to remove.
 */
export async function removeWorkflowFromMeta(
  projectDir: string,
  workflowPath: string,
): Promise<void> {
  const meta = await readWorkflowsMeta(projectDir);
  delete meta[workflowPath];
  await writeWorkflowsMeta(projectDir, meta);
}
