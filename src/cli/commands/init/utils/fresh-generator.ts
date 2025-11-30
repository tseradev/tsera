/**
 * Fresh project generator for TSera.
 *
 * This module generates a Fresh 2.1.4 project structure using `fresh init`
 * and adapts it to integrate with TSera's project structure.
 *
 * @module
 */

import { dirname, join, relative } from "../../../../shared/path.ts";
import { exists } from "std/fs";
import { walk } from "std/fs/walk";
import { ensureDir } from "../../../utils/fsx.ts";
import { createTSeraProject, formatAndSave } from "../../../utils/ts-morph.ts";

/**
 * Options for generating a Fresh project.
 */
export interface FreshGeneratorOptions {
  /** Target directory where Fresh should be generated (app/front/) */
  targetDir: string;
  /** Whether to overwrite existing files */
  force?: boolean;
}

/**
 * Generates a Fresh project structure in the target directory.
 *
 * This function:
 * 1. Executes `fresh init` in a temporary directory
 * 2. Copies the generated structure to the target directory
 * 3. Adapts files for TSera integration (paths, imports, secrets)
 *
 * @param options - Generation options
 * @returns List of files that were created
 */
export async function generateFreshProject(
  options: FreshGeneratorOptions,
): Promise<string[]> {
  const { targetDir, force = false } = options;

  // Create temporary directory for fresh init
  const tempDir = await Deno.makeTempDir({ prefix: "tsera-fresh-" });

  try {
    // Execute fresh init in temp directory
    const initProcess = new Deno.Command("deno", {
      args: [
        "run",
        "-A",
        "jsr:@fresh/init",
        ".",
        "--yes",
      ],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await initProcess.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Failed to run fresh init: ${errorText}`);
    }

    // Copy generated files to target directory, adapting for TSera
    const createdFiles: string[] = [];
    let freshDenoConfig: Record<string, unknown> | null = null;

    // Use walk with skip patterns to avoid node_modules and other problematic directories
    for await (
      const entry of walk(tempDir, {
        includeDirs: false,
        skip: [
          /\.deno/,
          /_fresh/,
          /\.git/,
        ],
      })
    ) {
      const relativePath = relative(tempDir, entry.path);

      // Skip files that shouldn't be copied
      if (shouldSkipFile(relativePath)) {
        // But read deno.json to extract config before skipping
        if (relativePath === "deno.json") {
          try {
            const content = await Deno.readTextFile(entry.path);
            freshDenoConfig = JSON.parse(content);
          } catch {
            // Ignore errors
          }
        }
        continue;
      }

      const targetPath = join(targetDir, relativePath);

      // Check if file already exists
      if (await exists(targetPath) && !force) {
        continue;
      }

      // Ensure target directory exists
      await ensureDir(dirname(targetPath));

      try {
        // Read and adapt file content if needed
        let content = await Deno.readTextFile(entry.path);
        content = adaptFileContent(relativePath, content, targetDir);

        // Write adapted content
        await Deno.writeTextFile(targetPath, content);
        createdFiles.push(relativePath);
      } catch {
        // Skip files that can't be read/written (e.g., symlinks, special files, node_modules)
        // This is expected for some files in node_modules/.deno/ and similar directories
        continue;
      }
    }

    // Use TS-Morph to adapt TypeScript files
    await adaptFreshFilesWithTSMorph(targetDir);

    // Write deno.json to target so template-composer can read and merge it
    if (freshDenoConfig) {
      const denoJsonPath = join(targetDir, "deno.json");
      await Deno.writeTextFile(
        denoJsonPath,
        JSON.stringify(freshDenoConfig, null, 2) + "\n",
      );
    }

    // Write TSera-specific README.md for the front module
    const readmePath = join(targetDir, "README.md");
    await Deno.writeTextFile(
      readmePath,
      generateFreshReadme(),
    );
    createdFiles.push("README.md");

    // Generate TSera-specific vite.config.ts (Fresh's default config is skipped)
    const viteConfigPath = join(targetDir, "vite.config.ts");
    await Deno.writeTextFile(
      viteConfigPath,
      generateViteConfig(),
    );
    createdFiles.push("vite.config.ts");

    return createdFiles;
  } finally {
    // Clean up temp directory
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Determines if a file should be skipped during copy.
 *
 * @param relativePath - Relative path from temp directory
 * @returns True if file should be skipped
 */
function shouldSkipFile(relativePath: string): boolean {
  // Skip deno.lock and other generated files
  // Also skip deno.json as it will be merged with the base deno.jsonc
  // Also skip README.md as we'll provide our own TSera-specific one
  // Also skip vite.config.ts as we generate our own TSera-specific configuration
  // Note: node_modules/ is NOT skipped - Fresh needs it
  const skipPatterns = [
    "deno.lock",
    "_fresh/",
    ".git/",
    "deno.json", // Will be merged with base deno.jsonc
    "README.md", // Will be replaced with TSera-specific README
    "vite.config.ts", // Will be replaced with TSera-specific Vite config
  ];

  return skipPatterns.some((pattern) => relativePath.includes(pattern) || relativePath === pattern);
}

/**
 * Adapts file content for TSera integration (legacy string-based approach).
 * Used for non-TypeScript files or as fallback.
 *
 * @param relativePath - Relative path of the file
 * @param content - Original file content
 * @param _targetDir - Target directory path
 * @returns Adapted file content
 */
function adaptFileContent(
  _relativePath: string,
  content: string,
  _targetDir: string,
): string {
  // TypeScript files are handled by TS-Morph in adaptFreshFilesWithTSMorph
  // Only handle non-TypeScript files here
  return content;
}

/**
 * Uses TS-Morph to adapt Fresh TypeScript files for TSera integration.
 *
 * @param targetDir - Target directory (app/front/)
 */
async function adaptFreshFilesWithTSMorph(targetDir: string): Promise<void> {
  const project = createTSeraProject();
  const mainTsPath = join(targetDir, "main.ts");
  const appTsxPath = join(targetDir, "routes", "_app.tsx");

  // Adapt main.ts
  if (await exists(mainTsPath)) {
    const content = await Deno.readTextFile(mainTsPath);
    const sourceFile = project.createSourceFile("main.ts", content, { overwrite: true });

    // Check if secrets initialization already exists
    const fullText = sourceFile.getFullText();
    const hasSecretsInit = fullText.includes("config/secrets/manager.ts");

    if (!hasSecretsInit) {
      // Insert secrets initialization after last import
      const imports = sourceFile.getImportDeclarations();
      const lastImport = imports[imports.length - 1];
      if (lastImport) {
        sourceFile.insertText(
          lastImport.getEnd(),
          `\n\n// Initialize TSera secrets if available\ntry {\n  await import("../../config/secrets/manager.ts");\n} catch {\n  // Secrets module not enabled, will use Deno.env\n}\n`,
        );
      }
    }

    // Add port adaptation at the end if not present
    if (!fullText.includes("if (import.meta.main)")) {
      sourceFile.addStatements([
        `\nif (import.meta.main) {\n  // Use tsera.env if secrets module is enabled, otherwise fall back to Deno.env\n  const port = (globalThis as { tsera?: { env: (key: string) => unknown } }).tsera?.env(\n    "FRESH_PORT",\n  ) as number ??\n    Number(Deno.env.get("PORT") ?? 8001);\n  \n  await app.listen({ port });\n  console.log(\`Fresh server listening on http://localhost:\${port}\`);\n}`,
      ]);
    }

    await formatAndSave(sourceFile, mainTsPath);
  }

  // Adapt _app.tsx
  if (await exists(appTsxPath)) {
    const content = await Deno.readTextFile(appTsxPath);
    const sourceFile = project.createSourceFile("_app.tsx", content, { overwrite: true });

    // Find and replace title using string replacement (simpler for JSX)
    const fullText = sourceFile.getFullText();
    const updatedText = fullText.replace(
      /<title>.*?<\/title>/,
      "<title>TSera App</title>",
    );

    if (updatedText !== fullText) {
      sourceFile.replaceWithText(updatedText);
      await formatAndSave(sourceFile, appTsxPath);
    }
  }
}


/**
 * Generates a TSera-specific README.md for the Fresh frontend.
 */
function generateFreshReadme(): string {
  return `# TSera Fresh Frontend

This directory contains the Fresh 2.1.4 frontend application.

## Development

From the ** project root **, run:

  \`\`\`bash
deno task dev:front
\`\`\`

This starts the Fresh development server with hot module reloading.

## Production Build

Build the frontend for production:

\`\`\`bash
deno task build:front
\`\`\`

Then start the production server:

\`\`\`bash
deno task start:front
\`\`\`

## Structure

- \`routes/\` - File-based routes (SSR pages)
- \`islands/\` - Interactive client-side components
- \`components/\` - Shared Preact components
- \`static/\` - Static assets (served at root)
- \`assets/\` - CSS and other build-time assets
- \`main.ts\` - Fresh application entry point
- \`utils.ts\` - Type-safe route/middleware definitions

## Configuration

The Vite configuration for the frontend is located at \`app/front/vite.config.ts\`.

## Learn More

- [Fresh Documentation](https://fresh.deno.dev)
- [TSera Documentation](https://github.com/yourusername/tsera)
`;
}

/**
 * Generates Vite configuration for TSera Fresh frontend.
 * 
 * Uses minimal configuration matching Fresh's standard setup.
 * The Fresh plugin handles most of the configuration automatically.
 */
function generateViteConfig(): string {
  return `import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";

export default defineConfig({
  plugins: [fresh()],
});
`;
}
