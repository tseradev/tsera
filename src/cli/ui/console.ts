/**
 * Base console reporter with tree-style formatting.
 *
 * This module provides a {@link BaseConsole} class that standardizes
 * console output with consistent tree-style formatting using box-drawing
 * characters (├─, └─, │).
 *
 * @module
 *
 * @example
 * ```typescript
 * import { BaseConsole } from "./console.ts";
 *
 * class MyConsole extends BaseConsole {
 *   showResults() {
 *     this.write("Results:");
 *     this.writeMiddle("Item 1");
 *     this.writeMiddle("Item 2");
 *     this.writeLast("Item 3");
 *   }
 * }
 * ```
 */

import { dim } from "./colors.ts";
import { TreeChars, type Writer } from "./types.ts";

/**
 * Base console reporter with common formatting patterns.
 *
 * Provides tree-style output with box-drawing characters for creating
 * hierarchical console output. Subclasses can use the protected methods
 * to maintain consistent formatting across different CLI commands.
 *
 * @example
 * ```typescript
 * class OperationConsole extends BaseConsole {
 *   start() {
 *     this.write("Starting operation...");
 *     this.writeMiddle("Step 1: Initialize");
 *     this.writeMiddle("Step 2: Process");
 *     this.writeLast("Step 3: Finalize");
 *   }
 * }
 *
 * const console = new OperationConsole();
 * console.start();
 * ```
 */
export class BaseConsole {
  /**
   * Output writer function.
   * @protected
   */
  protected writer: Writer;

  /**
   * Creates a new console instance.
   *
   * @param writer - Optional custom writer function. Defaults to console.log.
   *
   * @example
   * ```typescript
   * // Default console output
   * const console = new BaseConsole();
   *
   * // Custom writer for testing
   * const logs: string[] = [];
   * const testConsole = new BaseConsole((line) => logs.push(line));
   * ```
   */
  constructor(writer?: Writer) {
    this.writer = writer ?? ((line: string) => console.log(line));
  }

  /**
   * Writes a line to the output.
   *
   * @param line - The text to write
   * @protected
   *
   * @example
   * ```typescript
   * this.write("Processing complete");
   * ```
   */
  protected write(line: string): void {
    this.writer(line);
  }

  /**
   * Writes a tree branch with continuation (├─).
   *
   * Used for items that have siblings below them in the tree structure.
   *
   * @param content - The content to display after the branch character
   * @protected
   *
   * @example
   * ```typescript
   * this.writeMiddle("First item");
   * this.writeMiddle("Second item");
   * this.writeLast("Last item");
   * // Output:
   * // ├─ First item
   * // ├─ Second item
   * // └─ Last item
   * ```
   */
  protected writeMiddle(content: string): void {
    this.write(`${dim(TreeChars.MIDDLE)} ${content}`);
  }

  /**
   * Writes a final tree branch (└─).
   *
   * Used for the last item in a tree structure, indicating no more
   * siblings follow.
   *
   * @param content - The content to display after the branch character
   * @protected
   *
   * @example
   * ```typescript
   * this.writeMiddle("First step");
   * this.writeLast("Final step");
   * // Output:
   * // ├─ First step
   * // └─ Final step
   * ```
   */
  protected writeLast(content: string): void {
    this.write(`${dim(TreeChars.LAST)} ${content}`);
  }

  /**
   * Writes an indented sub-item with vertical continuation (│).
   *
   * Used for content that continues under a tree branch, maintaining
   * visual hierarchy.
   *
   * @param content - The content to display indented
   * @protected
   *
   * @example
   * ```typescript
   * this.writeMiddle("Main item");
   * this.writeSubItem("Sub-detail 1");
   * this.writeSubItem("Sub-detail 2");
   * this.writeLast("Another item");
   * // Output:
   * // ├─ Main item
   * // │  Sub-detail 1
   * // │  Sub-detail 2
   * // └─ Another item
   * ```
   */
  protected writeSubItem(content: string): void {
    this.write(`${dim(TreeChars.INDENT)}${content}`);
  }

  /**
   * Writes a bulleted item with custom prefix.
   *
   * Creates a list item with the specified prefix character.
   *
   * @param content - The content to display
   * @param prefix - Optional prefix character (defaults to "•")
   * @protected
   *
   * @example
   * ```typescript
   * this.writeBullet("First point");
   * this.writeBullet("Second point");
   * this.writeBullet("Custom prefix", "→");
   * // Output:
   * //    • First point
   * //    • Second point
   * //    → Custom prefix
   * ```
   */
  protected writeBullet(content: string, prefix: string = TreeChars.BULLET): void {
    this.write(`   ${dim(prefix)} ${content}`);
  }
}
