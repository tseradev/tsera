import { join } from "../../../../shared/path.ts";
import { pathExists } from "../../../utils/fsx.ts";

/**
 * Result of git repository initialization.
 */
export interface GitInitResult {
  /** Whether a new git repository was initialized. */
  initialized: boolean;
  /** Whether an initial commit was created. */
  committed: boolean;
  /** Error message if initialization failed (optional). */
  error?: string;
}

/**
 * Initializes a git repository and creates an initial commit.
 *
 * If a git repository already exists, this function does nothing.
 * If git is not installed or fails, the error is caught and returned
 * without throwing.
 *
 * @param targetDir - Target directory for the project.
 * @returns Result indicating what was done.
 */
export async function initializeGitRepository(
  targetDir: string,
): Promise<GitInitResult> {
  const gitDir = join(targetDir, ".git");

  // Check if git is already initialized
  if (await pathExists(gitDir)) {
    return { initialized: false, committed: false };
  }

  try {
    // Initialize git repository
    const initCommand = new Deno.Command("git", {
      args: ["init"],
      cwd: targetDir,
      stdout: "piped",
      stderr: "piped",
    });

    const initResult = await initCommand.output();
    if (!initResult.success) {
      const stderr = new TextDecoder().decode(initResult.stderr);
      return {
        initialized: false,
        committed: false,
        error: `git init failed: ${stderr.trim()}`,
      };
    }

    // Add all files
    const addCommand = new Deno.Command("git", {
      args: ["add", "-A"],
      cwd: targetDir,
      stdout: "piped",
      stderr: "piped",
    });

    const addResult = await addCommand.output();
    if (!addResult.success) {
      const stderr = new TextDecoder().decode(addResult.stderr);
      return {
        initialized: true,
        committed: false,
        error: `git add failed: ${stderr.trim()}`,
      };
    }

    // Create initial commit
    const commitCommand = new Deno.Command("git", {
      args: ["commit", "-m", "feat: boot tsera"],
      cwd: targetDir,
      stdout: "piped",
      stderr: "piped",
    });

    const commitResult = await commitCommand.output();
    if (!commitResult.success) {
      const stderr = new TextDecoder().decode(commitResult.stderr);
      // Check if the error is just "nothing to commit" (empty repository)
      const stderrText = stderr.trim();
      if (stderrText.includes("nothing to commit") || stderrText.includes("no changes")) {
        return {
          initialized: true,
          committed: false,
        };
      }
      return {
        initialized: true,
        committed: false,
        error: `git commit failed: ${stderrText}`,
      };
    }

    return { initialized: true, committed: true };
  } catch (error) {
    // Catch any errors (e.g., git not installed) and return gracefully
    const message = error instanceof Error ? error.message : String(error);
    return {
      initialized: false,
      committed: false,
      error: `git initialization failed: ${message}`,
    };
  }
}
