/**
 * Shared types and interfaces for CLI UI components.
 *
 * This module provides common type definitions used across UI components
 * to ensure consistency and type safety.
 *
 * @module
 */

/**
 * Tree-style box drawing characters for structured terminal output.
 *
 * These characters are used to create visual hierarchies in console output,
 * similar to file tree displays.
 *
 * @example
 * ```typescript
 * console.log(`${TreeChars.BRANCH} First item`);
 * console.log(`${TreeChars.MIDDLE} Second item`);
 * console.log(`${TreeChars.LAST} Last item`);
 * ```
 */
export const TreeChars = {
  /** Vertical line for continuation: │ */
  VERTICAL: "│",

  /** Branch with continuation below: ├─ */
  MIDDLE: "├─",

  /** Final branch with no continuation: └─ */
  LAST: "└─",

  /** Branch indicator: ├─ */
  BRANCH: "├─",

  /** Continuation of indented content: │  */
  INDENT: "│  ",

  /** Sub-item marker: • */
  BULLET: "•",
} as const;

/**
 * Output writer function signature.
 *
 * Used by UI components to output text. Can be replaced with custom
 * implementations for testing or output redirection.
 *
 * @param line - The line of text to write
 *
 * @example
 * ```typescript
 * const writer: Writer = (line) => console.log(line);
 * writer("Hello, world!");
 * ```
 */
export type Writer = (line: string) => void;

/**
 * Options for creating console-based UI components.
 */
export interface ConsoleOptions {
  /**
   * Custom writer function for output.
   * Defaults to console.log if not provided.
   */
  writer?: Writer;
}
