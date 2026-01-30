/**
 * VSCode configuration generator for TSera projects.
 *
 * This module generates VSCode configuration files that are appropriate
 * for all TSera projects, regardless of which modules are enabled.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import { ensureDir } from "../../../utils/fsx.ts";
import { safeWrite } from "../../../utils/fsx.ts";
import { normalizeNewlines } from "../../../../shared/newline.ts";

/**
 * Options for VSCode generation.
 */
export interface VscodeGeneratorOptions {
  /** Target directory where .vscode folder will be created. */
  targetDir: string;
  /** Whether to overwrite existing files. */
  force?: boolean;
}

/**
 * Result of VSCode generation.
 */
export interface VscodeGeneratorResult {
  /** List of files that were created. */
  createdFiles: string[];
  /** List of files that were skipped (already existed and force is false). */
  skippedFiles: string[];
}

/**
 * Generates VSCode settings.json for TSera projects.
 *
 * @returns Settings content for VSCode.
 */
function generateSettingsJson(): string {
  const settings = {
    "deno.enable": true,
    "deno.lint": true,
    "deno.unstable": ["true"],
    "deno.config": "./deno.jsonc",
    // Editor settings
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "denoland.vscode-deno",
    // File associations
    "files.associations": {
      "*.tsx": "typescriptreact",
      "*.ts": "typescript",
    },
  };

  return normalizeNewlines(JSON.stringify(settings, null, 2) + "\n");
}

/**
 * Generates VSCode extensions.json for TSera projects.
 *
 * This file recommends extensions that are useful for TSera projects.
 *
 * @returns Extensions recommendations content for VSCode.
 */
function generateExtensionsJson(): string {
  const extensions = {
    "recommendations": [
      "denoland.vscode-deno",
    ],
  };

  return normalizeNewlines(JSON.stringify(extensions, null, 2) + "\n");
}

/**
 * Generates VSCode configuration files for TSera projects.
 *
 * This function creates the .vscode directory and generates the following files:
 * - settings.json: VSCode settings for Deno and TypeScript
 * - extensions.json: Recommended extensions for TSera projects
 * - launch.json: Debug configurations for Deno
 *
 * @param options - Generator options.
 * @returns Generation result with file statistics.
 *
 * @example
 * ```typescript
 * const result = await generateVscodeConfig({
 *   targetDir: "/path/to/project",
 *   force: false,
 * });
 * console.log(`Created ${result.createdFiles.length} files`);
 * ```
 */
export async function generateVscodeConfig(
  options: VscodeGeneratorOptions,
): Promise<VscodeGeneratorResult> {
  const result: VscodeGeneratorResult = {
    createdFiles: [],
    skippedFiles: [],
  };

  const vscodeDir = join(options.targetDir, ".vscode");
  await ensureDir(vscodeDir);

  const filesToGenerate = [
    {
      name: "settings.json",
      content: generateSettingsJson(),
    },
    {
      name: "extensions.json",
      content: generateExtensionsJson(),
    }
  ];

  for (const file of filesToGenerate) {
    const filePath = join(vscodeDir, file.name);
    const relativePath = `.vscode/${file.name}`;

    // Write file and check if it was written
    const writeResult = await safeWrite(filePath, file.content);

    if (!writeResult.written && !options.force) {
      result.skippedFiles.push(relativePath);
    } else {
      result.createdFiles.push(relativePath);
    }
  }

  return result;
}
