/**
 * Normalizes workflow content before hash calculation.
 * Centralizes normalization to ensure consistency between computeWorkflowHash and computeFileHash.
 *
 * @param content - Workflow content to normalize.
 * @returns Normalized content.
 */
function normalizeWorkflowContent(content: string): string {
  // Normalize line endings (CRLF -> LF)
  // Trim trailing spaces and normalize newlines
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

/**
 * Computes the SHA-256 hash of workflow content.
 *
 * @param content - Workflow content.
 * @returns SHA-256 hash prefixed with "sha256-".
 */
export async function computeWorkflowHash(content: string): Promise<string> {
  const normalized = normalizeWorkflowContent(content);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256-${hashHex}`;
}

/**
 * Computes the hash of an existing workflow file.
 *
 * @param filePath - Absolute path of the workflow file.
 * @returns SHA-256 hash prefixed with "sha256-".
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await Deno.readTextFile(filePath);
  return await computeWorkflowHash(content);
}
