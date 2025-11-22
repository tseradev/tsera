/**
 * Utilities for uncommenting imports in generated project files.
 *
 * This module provides functions to automatically uncomment imports that were
 * commented out in templates to avoid dependency errors during project generation.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import { exists } from "std/fs";
import { parse as parseJsonc } from "jsr:@std/jsonc@1";
import {
  createTSeraProject,
  createInMemorySourceFile
} from "../../../utils/ts-morph.ts";
import { safeWrite } from "../../../utils/fsx.ts";

/**
 * Map of module specifiers to their import map keys.
 * This helps match commented imports to declared dependencies.
 */
interface DependencyMap {
  /** Map from module specifier (e.g., "hono") to import map key (e.g., "hono") */
  specifierToKey: Map<string, string>;
  /** Set of all declared import map keys */
  declaredKeys: Set<string>;
}

/**
 * Extracts dependencies from import_map.json and deno.jsonc.
 *
 * @param projectDir - Project root directory.
 * @returns Map of dependencies or null if no config files found.
 */
export async function extractDependencies(projectDir: string): Promise<DependencyMap | null> {
  const imports: Record<string, string> = {};

  // Check import_map.json
  const importMapPath = join(projectDir, "import_map.json");
  if (await exists(importMapPath)) {
    try {
      const content = await Deno.readTextFile(importMapPath);
      const importMap = parseJsonc(content) as { imports?: Record<string, string> };
      if (importMap.imports) {
        Object.assign(imports, importMap.imports);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check deno.jsonc
  const denoConfigPath = join(projectDir, "deno.jsonc");
  if (await exists(denoConfigPath)) {
    try {
      const content = await Deno.readTextFile(denoConfigPath);
      const denoConfig = parseJsonc(content) as { imports?: Record<string, string> };
      if (denoConfig.imports) {
        Object.assign(imports, denoConfig.imports);
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (Object.keys(imports).length === 0) {
    return null;
  }

  // Build maps for efficient lookup
  const specifierToKey = new Map<string, string>();
  const declaredKeys = new Set<string>(Object.keys(imports));

  // Map module specifiers to their import map keys
  // e.g., "hono" -> "hono", "jsr:@fresh/core@2" -> "fresh" or "@fresh/core"
  for (const [key, value] of Object.entries(imports)) {
    // Extract base name from key (remove trailing slash)
    const baseKey = key.replace(/\/$/, "");

    // Extract module name from value (npm:package or jsr:@scope/package@version)
    const npmMatch = value.match(/^npm:([^@]+)/);
    const jsrMatch = value.match(/^jsr:@?([^/@]+)\/([^@]+)/);

    if (npmMatch) {
      const packageName = npmMatch[1];
      specifierToKey.set(packageName, baseKey);
      // Also map scoped packages like @preact/signals
      if (packageName.startsWith("@")) {
        specifierToKey.set(packageName, baseKey);
      }
    } else if (jsrMatch) {
      const scope = jsrMatch[1];
      const packageName = jsrMatch[2];
      // Map both "fresh" and "@fresh/core" style imports
      specifierToKey.set(packageName, baseKey);
      specifierToKey.set(`@${scope}/${packageName}`, baseKey);
      // Also map the full JSR specifier
      const fullSpecifier = value.split("@")[0]; // Remove version
      specifierToKey.set(fullSpecifier, baseKey);
    }

    // Direct mapping: key -> key (for simple cases like "hono" -> "hono")
    specifierToKey.set(baseKey, baseKey);
  }

  return { specifierToKey, declaredKeys };
}

/**
 * Parses a commented import statement to extract import information.
 *
 * @param commentText - The commented import text (e.g., "// import { Hono } from \"hono\"")
 * @returns Parsed import info or null if not a valid import comment.
 */
function parseCommentedImport(commentText: string): {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports?: string[];
  typeOnly?: boolean;
} | null {
  // Remove comment markers
  let text = commentText.trim();
  if (text.startsWith("//")) {
    text = text.slice(2).trim();
  } else if (text.startsWith("/*")) {
    text = text.replace(/^\/\*+|\*+\/$/g, "").trim();
  }

  // Match import statements
  // import { X, Y } from "module"
  // import type { X } from "module"
  // import X from "module"
  // import * as X from "module"
  const importMatch = text.match(
    /^import\s+(type\s+)?(?:(?:\{([^}]+)\})|(\w+)|(?:\*\s+as\s+(\w+)))\s+from\s+["']([^"']+)["']/,
  );
  if (!importMatch) {
    return null;
  }

  const [, typeOnly, namedImportsStr, defaultImport, , moduleSpecifier] = importMatch;

  // Extract named imports
  let namedImports: string[] | undefined;
  if (namedImportsStr) {
    namedImports = namedImportsStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        // Handle aliases: "X as Y" -> "Y"
        const aliasMatch = s.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
        return aliasMatch ? (aliasMatch[2] || aliasMatch[1]) : s;
      });
  }

  // Ensure moduleSpecifier exists
  if (!moduleSpecifier) {
    return null;
  }

  return {
    moduleSpecifier,
    defaultImport: defaultImport || undefined,
    namedImports,
    typeOnly: !!typeOnly,
    // namespaceImport is not currently used but could be added
  };
}

/**
 * Checks if a module specifier matches a declared dependency.
 *
 * @param moduleSpecifier - The module specifier from the import.
 * @param dependencies - Dependency map.
 * @returns True if the dependency is declared.
 */
function isDependencyDeclared(
  moduleSpecifier: string,
  dependencies: DependencyMap,
): boolean {
  // Direct match
  if (dependencies.declaredKeys.has(moduleSpecifier)) {
    return true;
  }

  // Check specifier mapping
  const mappedKey = dependencies.specifierToKey.get(moduleSpecifier);
  if (mappedKey && dependencies.declaredKeys.has(mappedKey)) {
    return true;
  }

  // Check for JSR specifiers (e.g., "jsr:@fresh/core@2" -> "fresh")
  const jsrMatch = moduleSpecifier.match(/^jsr:@?([^/@]+)\/([^@]+)/);
  if (jsrMatch) {
    const packageName = jsrMatch[2];
    if (dependencies.specifierToKey.has(packageName)) {
      return true;
    }
  }

  // Check for npm specifiers (e.g., "npm:preact" -> "preact")
  const npmMatch = moduleSpecifier.match(/^npm:([^@]+)/);
  if (npmMatch) {
    const packageName = npmMatch[1];
    if (dependencies.specifierToKey.has(packageName)) {
      return true;
    }
  }

  // Check relative paths that might be aliased (e.g., "../../../deps/preact.ts")
  if (moduleSpecifier.includes("deps/")) {
    const depName = moduleSpecifier.split("deps/")[1]?.split(".")[0];
    if (depName && dependencies.specifierToKey.has(depName)) {
      return true;
    }
  }

  // Check tsera/ imports (e.g., "tsera/core/entity.ts" -> "tsera/")
  if (moduleSpecifier.startsWith("tsera/")) {
    if (dependencies.declaredKeys.has("tsera/")) {
      return true;
    }
  }

  return false;
}

/**
 * Uncomments imports in a source file if their dependencies are declared.
 * Uses text replacement for simplicity and reliability.
 *
 * @param content - File content as string.
 * @param dependencies - Dependency map.
 * @returns Modified content and whether it changed.
 */
function uncommentImportsInContent(
  content: string,
  dependencies: DependencyMap,
): { content: string; changed: boolean } {
  let changed = false;
  const lines = content.split("\n");
  const newLines: string[] = [];
  let uncommentNextLines = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for single-line commented imports (// import ...)
    if (trimmed.startsWith("// import") || trimmed.startsWith("//import")) {
      const importInfo = parseCommentedImport(line);
      if (importInfo && isDependencyDeclared(importInfo.moduleSpecifier, dependencies)) {
        // Uncomment the line by removing "// " prefix
        const uncommented = line.replace(/^(\s*)\/\/\s*/, "$1");
        newLines.push(uncommented);
        changed = true;
        // Mark that we should uncomment following lines that are part of the same block
        uncommentNextLines = true;
        continue;
      }
    }

    // If we're in a block that should be uncommented, uncomment lines starting with "// "
    if (uncommentNextLines && trimmed.startsWith("// ") && !trimmed.startsWith("// ====") && !trimmed.startsWith("// Install")) {
      const uncommented = line.replace(/^(\s*)\/\/\s*/, "$1");
      newLines.push(uncommented);
      changed = true;
      // Continue uncommenting until we hit a blank line or non-commented line
      if (trimmed === "//" || trimmed.length === 2) {
        // Empty comment line, stop uncommenting
        uncommentNextLines = false;
      }
      continue;
    } else if (uncommentNextLines && (trimmed === "" || (!trimmed.startsWith("//") && trimmed.length > 0))) {
      // Hit a non-commented line or blank line, stop uncommenting
      uncommentNextLines = false;
    }

    newLines.push(line);
  }

  // Process multi-line comment blocks (/* ... */)
  // Replace comment blocks that contain imports
  let processedContent = newLines.join("\n");
  const commentBlockRegex = /\/\*([\s\S]*?)\*\//g;
  let match;
  const matches: Array<{ start: number; end: number; content: string }> = [];

  // Collect all matches first
  while ((match = commentBlockRegex.exec(processedContent)) !== null) {
    const commentContent = match[1];
    const importInfo = parseCommentedImport(`/*${commentContent}*/`);
    if (importInfo && isDependencyDeclared(importInfo.moduleSpecifier, dependencies)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: commentContent.trim(),
      });
    }
  }

  // Replace matches in reverse order to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const before = processedContent.substring(0, match.start);
    const after = processedContent.substring(match.end);
    // Uncomment the content (remove /* and */)
    processedContent = before + match.content + after;
    changed = true;
  }

  return { content: processedContent, changed };
}

/**
 * Uncomments imports in a single file if dependencies are declared.
 *
 * @param filePath - Absolute path to the file.
 * @param dependencies - Dependency map.
 * @returns True if the file was modified.
 */
export async function uncommentImportsInFile(
  filePath: string,
  dependencies: DependencyMap,
): Promise<boolean> {
  if (!(await exists(filePath))) {
    return false;
  }

  try {
    const content = await Deno.readTextFile(filePath);
    const { content: newContent, changed } = uncommentImportsInContent(content, dependencies);

    if (changed) {
      // Use TS-Morph to format the result for consistency
      try {
        const project = createTSeraProject();
        const sourceFile = createInMemorySourceFile(project, filePath, newContent);
        sourceFile.formatText();
        const formattedContent = sourceFile.getFullText();
        await safeWrite(filePath, formattedContent);
      } catch {
        // If formatting fails, write the uncommented content as-is
        await safeWrite(filePath, newContent);
      }
      return true;
    }

    return false;
  } catch (error) {
    // If processing fails, return false
    // This can happen if the template has syntax issues, but we don't want to break the init
    console.warn(
      `Failed to uncomment imports in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * Recursively uncomments imports in all TypeScript/TSX files in a directory.
 *
 * @param dir - Directory to scan.
 * @param dependencies - Dependency map.
 * @param ignorePatterns - Patterns to ignore (e.g., [".tsera", "node_modules"]).
 * @returns Number of files modified.
 */
export async function uncommentImportsInDirectory(
  dir: string,
  dependencies: DependencyMap,
  ignorePatterns: string[] = [".tsera", "node_modules", ".git"],
): Promise<number> {
  let modifiedCount = 0;

  async function walk(currentDir: string): Promise<void> {
    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const fullPath = join(currentDir, entry.name);

        // Skip ignored patterns
        if (ignorePatterns.some((pattern) => fullPath.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory) {
          await walk(fullPath);
        } else if (entry.isFile && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const modified = await uncommentImportsInFile(fullPath, dependencies);
          if (modified) {
            modifiedCount++;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      if (!(error instanceof Deno.errors.PermissionDenied)) {
        console.warn(`Error walking directory ${currentDir}: ${error}`);
      }
    }
  }

  await walk(dir);
  return modifiedCount;
}

/**
 * Uncomments imports in the generated project based on declared dependencies.
 *
 * This is the main entry point that should be called after project generation
 * and dependency declaration in import_map.json or deno.jsonc.
 *
 * @param projectDir - Project root directory.
 * @returns Number of files modified.
 */
export async function uncommentImportsInProject(projectDir: string): Promise<number> {
  const dependencies = await extractDependencies(projectDir);
  if (!dependencies) {
    return 0;
  }

  return await uncommentImportsInDirectory(projectDir, dependencies);
}

