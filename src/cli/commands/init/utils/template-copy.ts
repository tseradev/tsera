import { dirname, join } from "../../../../shared/path.ts";
import { ensureDir, pathExists, safeWrite } from "../../../utils/fsx.ts";

/**
 * Result of copying a template directory.
 */
export interface CopyResult {
  /** Array of relative paths of files that were copied. */
  files: string[];
  /** Array of relative paths of files that were skipped (already existed). */
  skipped: string[];
}

/**
 * Copies a template directory recursively to a destination.
 *
 * @param source - Absolute path to the template directory
 * @param destination - Absolute path to the destination directory
 * @param options - Copy options (force overwrite existing files)
 * @returns Summary of copied and skipped files
 */
export async function copyTemplateDirectory(
  source: string,
  destination: string,
  options: { force: boolean },
): Promise<CopyResult> {
  const files: string[] = [];
  const skipped: string[] = [];

  await walk(source, async (relativePath, absoluteSource, entry) => {
    const targetPath = join(destination, relativePath);

    if (entry.isDirectory) {
      await ensureDir(targetPath);
      return;
    }

    if (!entry.isFile) {
      return;
    }

    if (!options.force && await pathExists(targetPath)) {
      skipped.push(relativePath);
      return;
    }

    const content = await Deno.readFile(absoluteSource);
    await ensureDir(dirname(targetPath));
    await safeWrite(targetPath, content);
    files.push(relativePath);
  });

  return { files, skipped };
}

/**
 * Recursively walks a directory tree, calling the visitor for each entry.
 */
async function walk(
  root: string,
  visitor: (relativePath: string, absolutePath: string, entry: Deno.DirEntry) => Promise<void>,
  current = "",
): Promise<void> {
  for await (const entry of Deno.readDir(join(root, current))) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    const absolute = join(root, relative);
    await visitor(relative, absolute, entry);
    if (entry.isDirectory) {
      await walk(root, visitor, relative);
    }
  }
}
