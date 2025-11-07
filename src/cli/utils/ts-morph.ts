/**
 * TS-Morph utilities for code generation in TSera.
 * 
 * This module provides helper functions to create, manipulate, and save TypeScript
 * files using the TS-Morph AST manipulation library.
 * 
 * @module
 */

import {
  IndentationText,
  ModuleKind,
  ModuleResolutionKind,
  NewLineKind,
  Project,
  type ProjectOptions,
  QuoteKind,
  ScriptTarget,
  type SourceFile,
} from "../../deps/polyfills/ts-morph.ts";
import { safeWrite } from "./fsx.ts";

/**
 * Default compiler options for TSera-generated TypeScript files.
 */
const DEFAULT_COMPILER_OPTIONS = {
  target: ScriptTarget.ES2022,
  module: ModuleKind.ESNext,
  moduleResolution: ModuleResolutionKind.Bundler,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
};

/**
 * Default manipulation settings for consistent code formatting.
 */
const DEFAULT_MANIPULATION_SETTINGS = {
  indentationText: IndentationText.TwoSpaces,
  newLineKind: NewLineKind.LineFeed,
  quoteKind: QuoteKind.Double,
  useTrailingCommas: true,
};

/**
 * Creates a configured TS-Morph Project instance for TSera code generation.
 * 
 * @param options - Optional project configuration overrides.
 * @returns A configured Project instance ready for code generation.
 * 
 * @example
 * ```typescript
 * const project = createTSeraProject();
 * const sourceFile = project.createSourceFile("example.ts", "");
 * ```
 */
export function createTSeraProject(options: Partial<ProjectOptions> = {}): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      ...DEFAULT_COMPILER_OPTIONS,
      ...options.compilerOptions,
    },
    manipulationSettings: {
      ...DEFAULT_MANIPULATION_SETTINGS,
      ...options.manipulationSettings,
    },
    ...options,
  });
}

/**
 * Result of formatting and saving a source file.
 */
export interface FormatAndSaveResult {
  /** Absolute path where the file was written. */
  path: string;
  /** Whether the file content changed compared to existing content. */
  changed: boolean;
  /** Whether the file was written to disk. */
  written: boolean;
}

/**
 * Formats a TS-Morph source file and writes it to disk using safeWrite.
 * 
 * This function ensures consistent formatting and only writes when the content
 * differs from the existing file, preventing unnecessary file system operations.
 * 
 * @param sourceFile - The TS-Morph source file to format and save.
 * @param targetPath - Absolute file system path where the file should be written.
 * @returns Result indicating whether the file was written and changed.
 * 
 * @example
 * ```typescript
 * const project = createTSeraProject();
 * const sourceFile = project.createSourceFile("temp.ts", 'export const x = 1;');
 * const result = await formatAndSave(sourceFile, "/path/to/output.ts");
 * console.log(`File ${result.changed ? 'changed' : 'unchanged'}`);
 * ```
 */
export async function formatAndSave(
  sourceFile: SourceFile,
  targetPath: string,
): Promise<FormatAndSaveResult> {
  // Format the source file using TS-Morph's built-in formatter
  sourceFile.formatText();

  // Get the formatted text
  const formattedText = sourceFile.getFullText();

  // Use safeWrite to only write if content differs
  const result = await safeWrite(targetPath, formattedText);

  return {
    path: result.path,
    changed: result.changed,
    written: result.written,
  };
}

/**
 * Options for adding an import declaration.
 */
export interface AddImportOptions {
  /** Default export name to import. */
  defaultImport?: string;
  /** Named imports to add. */
  namedImports?: string[] | Record<string, string>;
  /** Namespace import (import * as name). */
  namespaceImport?: string;
}

/**
 * Adds an import declaration to a source file with proper formatting.
 * 
 * This helper simplifies adding import statements to generated TypeScript files,
 * handling both named imports and default imports in a consistent way.
 * 
 * @param sourceFile - The source file to add the import to.
 * @param moduleSpecifier - The module path to import from (e.g., "zod").
 * @param options - Import options specifying what to import.
 * 
 * @example
 * ```typescript
 * const sourceFile = project.createSourceFile("example.ts", "");
 * 
 * // Add named imports
 * addImportDeclaration(sourceFile, "zod", { namedImports: ["z"] });
 * 
 * // Add default import
 * addImportDeclaration(sourceFile, "./User.entity.ts", { 
 *   defaultImport: "UserEntity" 
 * });
 * 
 * // Add aliased imports
 * addImportDeclaration(sourceFile, "std/assert", { 
 *   namedImports: { "assertEquals": "assertEquals" } 
 * });
 * ```
 */
export function addImportDeclaration(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  options: AddImportOptions = {},
): void {
  const { defaultImport, namedImports, namespaceImport } = options;

  sourceFile.addImportDeclaration({
    moduleSpecifier,
    defaultImport,
    namedImports: Array.isArray(namedImports)
      ? namedImports
      : namedImports
        ? Object.entries(namedImports).map(([name, alias]) => ({
          name,
          alias: alias !== name ? alias : undefined,
        }))
        : undefined,
    namespaceImport,
  });
}

/**
 * Creates an in-memory source file with the specified content.
 * 
 * @param project - The TS-Morph project instance.
 * @param fileName - Name for the in-memory file (used for diagnostics).
 * @param content - Initial content for the file.
 * @returns The created source file.
 * 
 * @example
 * ```typescript
 * const project = createTSeraProject();
 * const sourceFile = createInMemorySourceFile(
 *   project, 
 *   "example.ts", 
 *   "export const x = 1;"
 * );
 * ```
 */
export function createInMemorySourceFile(
  project: Project,
  fileName: string,
  content = "",
): SourceFile {
  return project.createSourceFile(fileName, content, { overwrite: true });
}

