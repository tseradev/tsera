/**
 * Lume project generator for TSera.
 *
 * This module generates a Lume project structure by copying files directly
 * from the Lume template module and adapting them to integrate with TSera's
 * project structure.
 *
 * @module
 */

import { dirname, join, relative } from "../../../../shared/path.ts";
import { exists } from "std/fs";
import { walk } from "std/fs/walk";
import { ensureDir } from "../../../utils/fsx.ts";

/**
 * Extensions of binary files that should be copied as binary data.
 */
const BINARY_EXTENSIONS = [
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp", ".tiff",
  // Fonts
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  // Archives
  ".zip", ".tar", ".gz", ".7z", ".rar",
  // Documents
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  // Media
  ".mp3", ".mp4", ".avi", ".mov", ".wav", ".ogg", ".webm",
];

/**
 * Determines if a file is binary based on its extension.
 *
 * @param filePath - Path to file
 * @returns True if file is binary
 */
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  return BINARY_EXTENSIONS.includes(ext);
}

/**
 * Options for generating a Lume project.
 */
export interface LumeGeneratorOptions {
  /** Target directory where Lume should be generated (app/front/) */
  targetDir: string;
  /** Root directory of the TSera project (for .vscode/ and other project-level files) */
  projectRootDir?: string;
  /** Whether to overwrite existing files */
  force?: boolean;
}

/**
 * Generates a Lume project structure in target directory.
 *
 * This function:
 * 1. Copies files directly from templates/modules/lume/ to target directory
 * 2. Adapts files for TSera integration (paths, imports, secrets if needed)
 * 3. Returns list of files that were created
 *
 * @param options - Generation options
 * @returns List of files that were created
 */
export async function generateLumeProject(
  options: LumeGeneratorOptions,
): Promise<string[]> {
  const { targetDir, projectRootDir, force = false } = options;

  // Path to Lume template module
  const lumeTemplatePath = join(
    Deno.cwd(),
    "templates",
    "modules",
    "lume",
  );

  // Verify template exists
  if (!(await exists(lumeTemplatePath))) {
    throw new Error(
      `Lume template not found at ${lumeTemplatePath}. Please ensure templates/modules/lume/ exists.`,
    );
  }

  // Copy generated files to target directory
  const createdFiles: string[] = [];

  // Use walk with skip patterns to avoid _site/, _cache/, .env/
  for await (
    const entry of walk(lumeTemplatePath, {
      includeDirs: false,
      skip: [
        /_site/,
        /_cache/,
        /\.env/,
        /\.git/,
      ],
    })
  ) {
    const relativePath = relative(lumeTemplatePath, entry.path);

    // Skip files that shouldn't be copied
    // Note: deno.jsonc is skipped here as it's merged with base deno.jsonc via config-merger.ts
    if (shouldSkipFile(relativePath)) {
      continue;
    }

    // Determine target path based on file type
    // .vscode/ files should be copied to project root, not app/front/
    const isVscodeFile = relativePath.startsWith(".vscode/");
    const actualTargetDir = isVscodeFile && projectRootDir ? projectRootDir : targetDir;
    const targetPath = join(actualTargetDir, relativePath);

    // Check if file already exists
    if (await exists(targetPath) && !force) {
      continue;
    }

    // Ensure target directory exists
    await ensureDir(dirname(targetPath));

    try {
      // Check if file is binary and use appropriate read/write methods
      if (isBinaryFile(relativePath)) {
        // Copy binary file directly without adaptation
        const binaryContent = await Deno.readFile(entry.path);
        await Deno.writeFile(targetPath, binaryContent);
        createdFiles.push(relativePath);
      } else {
        // Read and adapt file content if needed
        let content = await Deno.readTextFile(entry.path);
        content = adaptFileContent(relativePath, content, actualTargetDir);

        // Write adapted content
        await Deno.writeTextFile(targetPath, content);
        createdFiles.push(relativePath);
      }
    } catch {
      // Skip files that can't be read/written (e.g., symlinks, special files)
      continue;
    }
  }

  // Write TSera-specific README.md for front module
  const readmePath = join(targetDir, "README.md");
  await Deno.writeTextFile(
    readmePath,
    generateLumeReadme(),
  );
  createdFiles.push("README.md");

  return createdFiles;
}

/**
 * Determines if a file should be skipped during copy.
 *
 * @param relativePath - Relative path from Lume template directory
 * @returns True if file should be skipped
 */
function shouldSkipFile(relativePath: string): boolean {
  // Skip deno.jsonc as it will be merged with base deno.jsonc
  // Skip README.md as we'll provide our own TSera-specific one
  const skipPatterns = [
    "_site/",
    "_cache/",
    ".env/",
    ".git/",
    "deno.jsonc", // Will be merged with base deno.jsonc
    "README.md", // Will be replaced with TSera-specific README
  ];

  return skipPatterns.some((pattern) =>
    relativePath.includes(pattern) || relativePath === pattern
  );
}

/**
 * Adapts file content for TSera integration.
 *
 * @param relativePath - Relative path of file
 * @param content - Original file content
 * @param _targetDir - Target directory path
 * @returns Adapted file content
 */
function adaptFileContent(
  _relativePath: string,
  content: string,
  _targetDir: string,
): string {
  // Lume templates are designed for TSera integration
  // No complex adaptation needed at this time
  return content;
}

/**
 * Generates a TSera-specific README.md for Lume frontend.
 */
function generateLumeReadme(): string {
  return `# TSera Lume Frontend

This directory contains a Lume static site generator application.

## Development

From the project root, run:

\`\`\`bash
deno task dev:front
\`\`\`

This starts the Lume development server with live reloading.

## Production Build

Build the site for production:

\`\`\`bash
deno task build:front
\`\`\`

The static site will be generated in the \`_site/\` directory.

## Structure

- \`_config.ts\` - Lume configuration file
- \`src/\` - Source files for pages and components
  - \`*.page.ts\` - Page files (auto-routed)
  - \`_includes/\` - Layouts and partials
  - \`assets/\` - CSS, images, and other static assets
- \`_site/\` - Generated static site (build output)
- \`_cache/\` - Lume build cache

## Configuration

Lume configuration is located at \`app/front/_config.ts\`.

## Learn More

- [Lume Documentation](https://lume.land)
- [TSera Documentation](https://github.com/yourusername/tsera)
`;
}
